import "server-only";

import { getAiProviderRuntimeConfig } from "@/lib/ai/config";
import type { CategoryPlan, GraphPlanningSummary, KnowledgeAtom } from "@/lib/zhimai-data";

export type ExistingTopicCandidate = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
};

export type AlphaPlanningInput = {
  accessToken?: string;
  note?: string | null;
  rawContent: string;
  selectedText?: string | null;
  sourceTitle?: string | null;
  sourceType: string;
  workspaceId: string;
  existingTopics: ExistingTopicCandidate[];
};

type AiPlanningPayload = {
  atoms?: Array<Partial<KnowledgeAtom>>;
  plan?: Partial<CategoryPlan>;
};

const atomTypes = new Set<KnowledgeAtom["type"]>([
  "concept",
  "claim",
  "method",
  "case",
  "data_point",
  "question",
  "definition",
  "taxonomy",
  "risk",
  "decision",
]);

const planActions = new Set<CategoryPlan["action"]>([
  "update_existing_topic",
  "create_new_topic",
  "create_subtopic",
  "merge_with_topic",
  "split_into_multiple_topics",
  "append_as_evidence",
  "archive_as_source_only",
  "hold_for_more_sources",
]);

export async function generateAlphaPlanning(input: AlphaPlanningInput): Promise<GraphPlanningSummary> {
  const config = await getAiProviderRuntimeConfig(input.workspaceId, input.accessToken).catch(() => null);

  if (config?.isEnabled) {
    const aiPlan = await callPlannerModel(input, config).catch((error) => {
      console.warn("Knowledge graph planning failed, falling back to heuristic.", error);
      return null;
    });

    if (aiPlan) return aiPlan;
  }

  return buildHeuristicPlanning(input);
}

export function buildTopicMarkdown(input: {
  atoms: KnowledgeAtom[];
  existingContent?: string | null;
  plan: CategoryPlan;
  rawContent: string;
  sourceTitle?: string | null;
}) {
  const atomLines = input.atoms.map((atom) => `- ${atom.title}：${atom.content}`);
  const sourceTitle = input.sourceTitle || "未命名来源";
  const sourceBlock = [`- ${sourceTitle}`];

  if (input.plan.action === "update_existing_topic" && input.existingContent) {
    return [
      input.existingContent.trim(),
      "## 新增知识",
      ...atomLines,
      "## 本次归类判断",
      input.plan.reason,
      "## 新增来源",
      ...sourceBlock,
    ].join("\n\n");
  }

  return [
    `# ${input.plan.targetTitle}`,
    "## 一句话解释",
    input.plan.reason,
    "## 当前结论",
    ...atomLines,
    "## 待继续研究的问题",
    ...input.atoms
      .filter((atom) => atom.type === "question")
      .map((atom) => `- ${atom.content}`)
      .concat(input.atoms.some((atom) => atom.type === "question") ? [] : ["- 后续继续补充来源后再沉淀更稳定结论。"]),
    "## 来源材料",
    ...sourceBlock,
  ].join("\n\n");
}

async function callPlannerModel(
  input: AlphaPlanningInput,
  config: NonNullable<Awaited<ReturnType<typeof getAiProviderRuntimeConfig>>>,
) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是知脉的知识架构师。你的任务不是写文章，而是提取知识原子，并判断新知识应该更新已有主题还是新建主题。必须只输出 JSON。",
        },
        {
          role: "user",
          content: buildPlannerPrompt(input),
        },
      ],
      temperature: 0.1,
      max_tokens: 2200,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 规划失败：${response.status} ${text.slice(0, 160)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  return normalizePlanning(JSON.parse(content) as AiPlanningPayload, input);
}

function buildPlannerPrompt(input: AlphaPlanningInput) {
  const sourceText = input.selectedText || input.rawContent;
  const candidates = input.existingTopics.slice(0, 12).map((topic) => ({
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    excerpt: topic.content?.slice(0, 320),
  }));

  return [
    "请基于新来源输出知识图谱 alpha 规划。",
    "",
    "输出 JSON 格式：",
    JSON.stringify(
      {
        atoms: [
          {
            type: "claim",
            title: "一个短标题",
            content: "稳定表达的知识点",
            quote: "可追溯原文片段",
            confidence: 0.8,
          },
        ],
        plan: {
          action: "update_existing_topic",
          targetTitle: "目标主题",
          targetPageId: "如果更新已有主题，填写候选主题 id",
          targetLevel: "topic",
          reason: "为什么这样归类",
          confidence: 0.8,
        },
      },
      null,
      2,
    ),
    "",
    "允许的 atom.type：concept, claim, method, case, data_point, question, definition, taxonomy, risk, decision。",
    "允许的 plan.action：update_existing_topic, create_new_topic, create_subtopic, merge_with_topic, split_into_multiple_topics, append_as_evidence, archive_as_source_only, hold_for_more_sources。",
    "如果新来源明显补充已有主题，优先 update_existing_topic。只有主题边界清晰且已有主题承载不了时，才 create_new_topic。",
    "",
    `来源类型：${input.sourceType}`,
    `标题：${input.sourceTitle || "未命名来源"}`,
    input.note ? `用户备注：${input.note}` : "",
    "候选已有主题：",
    JSON.stringify(candidates, null, 2),
    "新来源内容：",
    sourceText.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizePlanning(payload: AiPlanningPayload, input: AlphaPlanningInput): GraphPlanningSummary {
  const atoms = (payload.atoms ?? [])
    .slice(0, 12)
    .map((atom) => ({
      type: atomTypes.has(atom.type as KnowledgeAtom["type"]) ? (atom.type as KnowledgeAtom["type"]) : "claim",
      title: cleanText(atom.title, 80) || inferTitle(input),
      content: cleanText(atom.content, 500) || input.rawContent.slice(0, 240),
      quote: cleanText(atom.quote, 300) || undefined,
      confidence: clampConfidence(atom.confidence),
    }))
    .filter((atom) => atom.content);

  const fallbackAtoms = atoms.length ? atoms : buildHeuristicAtoms(input);
  const rawPlan = payload.plan ?? {};
  const targetPage = input.existingTopics.find((topic) => topic.id === rawPlan.targetPageId);
  const action = planActions.has(rawPlan.action as CategoryPlan["action"])
    ? (rawPlan.action as CategoryPlan["action"])
    : targetPage
      ? "update_existing_topic"
      : "create_new_topic";

  return {
    atoms: fallbackAtoms,
    plan: {
      action,
      targetTitle: cleanText(rawPlan.targetTitle, 80) || targetPage?.title || inferTitle(input),
      targetPageId: targetPage?.id,
      targetLevel: rawPlan.targetLevel === "subtopic" || rawPlan.targetLevel === "domain" || rawPlan.targetLevel === "aspect" ? rawPlan.targetLevel : "topic",
      reason: cleanText(rawPlan.reason, 400) || "系统根据来源主题和已有知识结构做出的类目规划。",
      confidence: clampConfidence(rawPlan.confidence),
    },
  };
}

function buildHeuristicPlanning(input: AlphaPlanningInput): GraphPlanningSummary {
  const atoms = buildHeuristicAtoms(input);
  const title = inferTitle(input);
  const matchedTopic = findSimilarTopic(title, input.rawContent, input.existingTopics);

  return {
    atoms,
    plan: {
      action: matchedTopic ? "update_existing_topic" : "create_new_topic",
      targetTitle: matchedTopic?.title ?? title,
      targetPageId: matchedTopic?.id,
      targetLevel: "topic",
      reason: matchedTopic
        ? `新来源与已有主题「${matchedTopic.title}」语义相近，优先作为主题补充。`
        : "没有找到足够接近的已有主题，建议先创建新主题。",
      confidence: matchedTopic ? 0.72 : 0.58,
    },
  };
}

function buildHeuristicAtoms(input: AlphaPlanningInput): KnowledgeAtom[] {
  const source = input.selectedText || input.rawContent;
  const sentences = source
    .split(/[。！？!?\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8)
    .slice(0, 5);

  const base = sentences.length ? sentences : [source.slice(0, 240)];
  return base.map((sentence, index) => ({
    type: index === 0 ? "claim" : "concept",
    title: sentence.slice(0, 36),
    content: sentence.slice(0, 300),
    quote: sentence.slice(0, 180),
    confidence: 0.55,
  }));
}

function findSimilarTopic(title: string, rawContent: string, topics: ExistingTopicCandidate[]) {
  const terms = getTerms(`${title} ${rawContent}`).slice(0, 12);
  let best: { score: number; topic: ExistingTopicCandidate } | null = null;

  for (const topic of topics) {
    const haystack = `${topic.title} ${topic.summary ?? ""} ${topic.content ?? ""}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (!best || score > best.score) {
      best = { score, topic };
    }
  }

  return best && best.score >= Math.min(3, terms.length) ? best.topic : null;
}

function getTerms(value: string) {
  return Array.from(new Set(value.toLowerCase().match(/[\p{Letter}\p{Number}]{2,}/gu) ?? []));
}

function inferTitle(input: AlphaPlanningInput) {
  return cleanText(input.sourceTitle, 80) || cleanText(input.rawContent.split(/\n/)[0], 40) || "未命名主题";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function clampConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.6;
}
