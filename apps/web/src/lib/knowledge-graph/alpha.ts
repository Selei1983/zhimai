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
  const sourceMarkdown = prepareSourceMarkdown(input);
  const chunks = splitMarkdown(sourceMarkdown, 10_000);

  if (chunks.length > 1) {
    const chunkResults = await Promise.all(
      chunks.map((chunk, index) => callChunkAnalyzer(chunk, index, chunks.length, input, config)),
    );
    const atoms = chunkResults.flatMap((result) => result.atoms ?? []).slice(0, 36);
    return callSynthesisPlanner(input, atoms, config);
  }

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
          content: buildPlannerPrompt(input, sourceMarkdown),
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

async function callChunkAnalyzer(
  chunk: string,
  index: number,
  total: number,
  input: AlphaPlanningInput,
  config: NonNullable<Awaited<ReturnType<typeof getAiProviderRuntimeConfig>>>,
): Promise<AiPlanningPayload> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "你是知脉的知识分析师。请从文档分块中提取真正有信息量、可独立理解的知识原子。忽略文件名、格式、页码和目录等元信息。只输出 JSON。",
        },
        {
          role: "user",
          content: [
            `文档：${input.sourceTitle || "未命名来源"}`,
            `这是第 ${index + 1}/${total} 个分块。`,
            "输出 JSON：{\"atoms\":[{\"type\":\"claim\",\"title\":\"短标题\",\"content\":\"完整解释，包含背景、结论与必要细节\",\"quote\":\"原文依据\",\"confidence\":0.8}]}。",
            "每块提取 3-6 个最重要知识点；content 不得复述标题，不得提取文件元信息。",
            "文档分块：",
            chunk,
          ].join("\n\n"),
        },
      ],
      temperature: 0.1,
      max_tokens: 2200,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`AI 分块分析失败：${response.status}`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  return content ? (JSON.parse(content) as AiPlanningPayload) : {};
}

async function callSynthesisPlanner(
  input: AlphaPlanningInput,
  atoms: Array<Partial<KnowledgeAtom>>,
  config: NonNullable<Awaited<ReturnType<typeof getAiProviderRuntimeConfig>>>,
) {
  const synthesisInput = {
    ...input,
    rawContent: [
      `# ${input.sourceTitle || "未命名来源"}`,
      "",
      "## 分块分析结果",
      JSON.stringify(atoms, null, 2),
    ].join("\n"),
    selectedText: null,
  };
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "你是知脉的知识架构师。请合并重复观点、保留不同维度，形成一组有层次的知识原子，并完成新建或更新主题判断。只输出 JSON。",
        },
        { role: "user", content: buildPlannerPrompt(synthesisInput, synthesisInput.rawContent) },
      ],
      temperature: 0.1,
      max_tokens: 3200,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`AI 汇总分析失败：${response.status}`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  return content ? normalizePlanning(JSON.parse(content) as AiPlanningPayload, input) : null;
}

function buildPlannerPrompt(input: AlphaPlanningInput, sourceText = prepareSourceMarkdown(input)) {
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
    "如果来源是未解析文件，只包含文件名、文件类型、文件大小、待解析等占位信息，不得因为这些通用文件元信息更新已有主题；除非文件标题几乎相同，否则应 create_new_topic 或 hold_for_more_sources。",
    "",
    `来源类型：${input.sourceType}`,
    `标题：${input.sourceTitle || "未命名来源"}`,
    input.note ? `用户备注：${input.note}` : "",
    "候选已有主题：",
    JSON.stringify(candidates, null, 2),
    "新来源内容：",
    sourceText.slice(0, 24_000),
  ]
    .filter(Boolean)
    .join("\n");
}

function prepareSourceMarkdown(input: AlphaPlanningInput) {
  const source = input.selectedText || input.rawContent;
  if (input.sourceType !== "file" || !source.includes("# PDF 正文")) return source;

  const body = source.split("# PDF 正文").slice(1).join("# PDF 正文").trim();
  return [`# ${input.sourceTitle || "PDF 文档"}`, "", body]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function splitMarkdown(markdown: string, maxLength: number) {
  if (markdown.length <= maxLength) return [markdown];
  const sections = markdown.split(/(?=^## 第 \d+ 页)/gm).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const section of sections.length > 1 ? sections : markdown.split(/\n\n+/)) {
    if (current && current.length + section.length > maxLength) {
      chunks.push(current.trim());
      current = "";
    }
    if (section.length > maxLength) {
      if (current) chunks.push(current.trim());
      for (let offset = 0; offset < section.length; offset += maxLength) {
        chunks.push(section.slice(offset, offset + maxLength).trim());
      }
      current = "";
      continue;
    }
    current += `${current ? "\n\n" : ""}${section}`;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
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
  const safeTargetPage = targetPage && isSafeUpdateTarget(input, targetPage) ? targetPage : undefined;
  const rawAction = planActions.has(rawPlan.action as CategoryPlan["action"])
    ? (rawPlan.action as CategoryPlan["action"])
    : safeTargetPage
      ? "update_existing_topic"
      : "create_new_topic";
  const action = rawAction === "update_existing_topic" && !safeTargetPage ? "create_new_topic" : rawAction;

  return {
    atoms: fallbackAtoms,
    plan: {
      action,
      targetTitle: action === "update_existing_topic"
        ? safeTargetPage?.title ?? cleanText(rawPlan.targetTitle, 80) ?? inferTitle(input)
        : cleanText(rawPlan.targetTitle, 80) || inferTitle(input),
      targetPageId: action === "update_existing_topic" ? safeTargetPage?.id : undefined,
      targetLevel: rawPlan.targetLevel === "subtopic" || rawPlan.targetLevel === "domain" || rawPlan.targetLevel === "aspect" ? rawPlan.targetLevel : "topic",
      reason: cleanText(rawPlan.reason, 400) || "系统根据来源主题和已有知识结构做出的类目规划。",
      confidence: clampConfidence(rawPlan.confidence),
    },
  };
}

function buildHeuristicPlanning(input: AlphaPlanningInput): GraphPlanningSummary {
  const atoms = buildHeuristicAtoms(input);
  const title = inferTitle(input);
  const matchedTopic = isUnparsedFilePlaceholder(input)
    ? findSameTitleTopic(title, input.existingTopics)
    : findSimilarTopic(title, input.rawContent, input.existingTopics);

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
  if (isUnparsedFilePlaceholder(input)) {
    const title = inferTitle(input);
    return [
      {
        type: "question",
        title: `待解析文件：${title}`,
        content: `文件「${title}」已进入收集箱，但当前还没有抽取正文。需要完成文件解析后，再生成可沉淀的实质知识。`,
        quote: cleanText(input.rawContent, 180),
        confidence: 0.4,
      },
    ];
  }

  const source = prepareSourceMarkdown(input);
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
  const minScore = Math.max(3, Math.ceil(terms.length * 0.35));
  let best: { score: number; topic: ExistingTopicCandidate } | null = null;

  for (const topic of topics) {
    const haystack = normalizeForTerms(`${topic.title} ${topic.summary ?? ""} ${topic.content ?? ""}`);
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (!best || score > best.score) {
      best = { score, topic };
    }
  }

  return best && best.score >= minScore ? best.topic : null;
}

function findSameTitleTopic(title: string, topics: ExistingTopicCandidate[]) {
  const normalizedTitle = normalizeTitle(title);
  return topics.find((topic) => normalizeTitle(topic.title) === normalizedTitle) ?? null;
}

function isSafeUpdateTarget(input: AlphaPlanningInput, topic: ExistingTopicCandidate) {
  if (isUnparsedFilePlaceholder(input)) {
    return normalizeTitle(inferTitle(input)) === normalizeTitle(topic.title);
  }

  return true;
}

function getTerms(value: string) {
  return Array.from(new Set(normalizeForTerms(value).match(/[\p{Letter}\p{Number}]{2,}/gu) ?? []))
    .filter((term) => !stopTerms.has(term))
    .filter((term) => term.length >= 2);
}

const stopTerms = new Set([
  "application",
  "pdf",
  "未知",
  "文件",
  "文件名",
  "文件类型",
  "文件大小",
  "待解析",
  "来源",
  "内容",
  "正文",
  "章节",
  "表格",
  "图片",
  "记录",
  "上传",
  "后续",
]);

function normalizeForTerms(value: string) {
  return value
    .toLowerCase()
    .replace(/这个文件已记录为上传来源/g, " ")
    .replace(/后续接入文件存储与解析服务后/g, " ")
    .replace(/会抽取正文、章节、表格或图片内容/g, " ")
    .replace(/\.(pdf|docx?|pptx?|xlsx?|txt|md)\b/g, " ");
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/\.(pdf|docx?|pptx?|xlsx?|txt|md)\b/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .trim();
}

function isUnparsedFilePlaceholder(input: AlphaPlanningInput) {
  return (
    input.sourceType === "file" &&
    input.rawContent.includes("## 待解析") &&
    input.rawContent.includes("这个文件已记录为上传来源")
  );
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
