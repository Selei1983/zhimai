import { createInsForgeClient } from "@/lib/insforge/client";
import { normalizeSourceType, parserLabel } from "@/lib/captures/source-types";
import {
  formatDate,
  getInsForgeErrorMessage,
  type InsForgeCaptureRow,
  type InsForgePageRow,
  toCapture,
  toWikiPage,
} from "@/lib/insforge/mappers";
import { buildTopicMarkdown, generateAlphaPlanning, type ExistingTopicCandidate } from "@/lib/knowledge-graph/alpha";
import type { CategoryPlan, KnowledgeAtom, PlanningRunSummary, TopicNodeSummary } from "@/lib/zhimai-data";

const pageSelect = "id,title,type,status,updated_at,content_markdown,libraries(name),folders(name)";

type LibraryRef = {
  id: string;
  name: string;
};

type FolderRef = {
  id: string;
  name: string;
};

type CaptureDetailRow = InsForgeCaptureRow & {
  raw_content: string;
  note: string | null;
  selected_text: string | null;
};

type ExistingPageRow = {
  id: string;
  title: string;
  summary: string | null;
  content_markdown: string | null;
};

export async function createInsForgeWikiPage(input: {
  title?: string;
  libraryName: string;
  folderName: string;
}, workspaceId: string, accessToken?: string) {
  const client = createInsForgeClient(accessToken);
  const title = input.title?.trim() || "未命名页面";
  const library = await ensureLibrary(input.libraryName, workspaceId, accessToken);
  const folder = await ensureFolder(library, input.folderName, workspaceId, accessToken);

  const { data, error } = await client.database
    .from("wiki_pages")
    .insert({
      workspace_id: workspaceId,
      library_id: library.id,
      folder_id: folder.id,
      title,
      slug: `${slugify(title)}-${Date.now()}`,
      type: "观点",
      summary: "新建 Wiki 页面",
      content_markdown: "这里开始整理你的知识。",
    })
    .select(pageSelect)
    .single();

  assertNoError("新建 Wiki 页面失败", error);
  return toWikiPage(data as InsForgePageRow);
}

export async function updateInsForgeWikiPage(input: {
  id: string;
  title: string;
  contentMarkdown: string;
}, workspaceId: string, accessToken?: string) {
  const client = createInsForgeClient(accessToken);
  const title = input.title.trim();
  const contentMarkdown = input.contentMarkdown.trim();

  if (!title) {
    throw new Error("标题不能为空");
  }

  if (!contentMarkdown) {
    throw new Error("正文不能为空");
  }

  const { data, error } = await client.database
    .from("wiki_pages")
    .update({
      title,
      content_markdown: contentMarkdown,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("workspace_id", workspaceId)
    .select(pageSelect)
    .single();

  assertNoError("保存 Wiki 页面失败", error);

  const versionResult = await client.database.from("page_versions").insert({
    page_id: input.id,
    content_markdown: contentMarkdown,
    change_note: "手动编辑保存",
  });

  assertNoError("保存页面版本失败", versionResult.error);
  return toWikiPage(data as InsForgePageRow);
}

export async function createInsForgeCapture(input: {
  rawContent: string;
  note?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  selectedText?: string;
  sourceType?: string;
}, workspaceId: string, accessToken?: string) {
  const client = createInsForgeClient(accessToken);
  const rawContent = input.rawContent.trim();
  const note = input.note?.trim();

  if (!rawContent) {
    throw new Error("收集内容不能为空");
  }

  const { data, error } = await client.database
    .from("captures")
    .insert({
      workspace_id: workspaceId,
      source_type: input.sourceType ?? "manual",
      source_title: input.sourceTitle?.trim() || rawContent.split(/\n/)[0].slice(0, 40),
      source_url: input.sourceUrl?.trim(),
      selected_text: input.selectedText?.trim(),
      raw_content: rawContent,
      note,
      status: "pending",
    })
    .select("id,source_type,source_title,status")
    .single();

  assertNoError("写入收集箱失败", error);
  return toCapture(data as InsForgeCaptureRow);
}

export async function createInsForgeWikiPageFromCapture(
  input: { captureId: string },
  workspaceId: string,
  accessToken?: string,
) {
  const client = createInsForgeClient(accessToken);
  const captureResult = await client.database
    .from("captures")
    .select("id,source_type,source_title,status,raw_content,note,selected_text")
    .eq("id", input.captureId)
    .eq("workspace_id", workspaceId)
    .single();

  assertNoError("读取收集内容失败", captureResult.error);
  const capture = captureResult.data as CaptureDetailRow;

  const library = await ensureLibrary("个人 Wiki", workspaceId, accessToken);
  const folder = await ensureFolder(library, "知识管理", workspaceId, accessToken);
  const existingTopics = await listExistingTopics(workspaceId, accessToken);
  const planning = await generateAlphaPlanning({
    accessToken,
    existingTopics,
    note: capture.note,
    rawContent: capture.raw_content,
    selectedText: capture.selected_text,
    sourceTitle: capture.source_title,
    sourceType: capture.source_type,
    workspaceId,
  });
  const targetPage = planning.plan.targetPageId
    ? existingTopics.find((topic) => topic.id === planning.plan.targetPageId)
    : undefined;
  const shouldUpdate = planning.plan.action === "update_existing_topic" && targetPage;
  const contentMarkdown = buildTopicMarkdown({
    atoms: planning.atoms,
    existingContent: shouldUpdate ? targetPage.content : null,
    plan: planning.plan,
    rawContent: capture.raw_content,
    sourceTitle: capture.source_title,
  });

  const pageResult = shouldUpdate
    ? await client.database
        .from("wiki_pages")
        .update({
          summary: planning.atoms[0]?.content.slice(0, 120) ?? capture.raw_content.slice(0, 120),
          content_markdown: contentMarkdown,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetPage.id)
        .eq("workspace_id", workspaceId)
        .select(pageSelect)
        .single()
    : await client.database
        .from("wiki_pages")
        .insert({
          workspace_id: workspaceId,
          library_id: library.id,
          folder_id: folder.id,
          title: planning.plan.targetTitle,
          slug: `${slugify(planning.plan.targetTitle)}-${Date.now()}`,
          type: "观点",
          summary: planning.atoms[0]?.content.slice(0, 120) ?? capture.raw_content.slice(0, 120),
          content_markdown: contentMarkdown,
        })
        .select(pageSelect)
        .single();

  assertNoError(shouldUpdate ? "更新主题页失败" : "从收集箱生成主题页失败", pageResult.error);
  const page = pageResult.data as InsForgePageRow;

  const sourceResult = await client.database.from("page_sources").insert({
    page_id: page.id,
    capture_id: capture.id,
    quote: capture.selected_text ?? capture.raw_content.slice(0, 200),
    note: `V2 alpha：${actionLabel(planning.plan.action)}；${planning.plan.reason}`,
  });
  assertNoError("记录页面来源失败", sourceResult.error);

  const versionResult = await client.database.from("page_versions").insert({
    page_id: page.id,
    content_markdown: contentMarkdown,
    change_note: shouldUpdate ? "V2 alpha 更新已有主题" : "V2 alpha 新建主题",
  });
  assertNoError("保存主题页版本失败", versionResult.error);

  const graphWrite = await recordAlphaGraph({
    accessToken,
    atoms: planning.atoms,
    captureId: capture.id,
    pageId: page.id,
    plan: planning.plan,
    workspaceId,
  });

  const updateCaptureResult = await client.database
    .from("captures")
    .update({
      status: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", capture.id)
    .eq("workspace_id", workspaceId)
    .select("id,source_type,source_title,status")
    .single();

  assertNoError("更新收集箱状态失败", updateCaptureResult.error);

  return {
    capture: toCapture(updateCaptureResult.data as InsForgeCaptureRow),
    graph: graphWrite,
    page: toWikiPage(page),
  };
}

async function listExistingTopics(workspaceId: string, accessToken?: string): Promise<ExistingTopicCandidate[]> {
  const client = createInsForgeClient(accessToken);
  const result = await client.database
    .from("wiki_pages")
    .select("id,title,summary,content_markdown")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(30);

  assertNoError("读取已有主题失败", result.error);
  return ((result.data ?? []) as ExistingPageRow[]).map((page) => ({
    id: page.id,
    title: page.title,
    summary: page.summary,
    content: page.content_markdown,
  }));
}

async function recordAlphaGraph(input: {
  accessToken?: string;
  atoms: KnowledgeAtom[];
  captureId: string;
  pageId: string;
  plan: CategoryPlan;
  workspaceId: string;
}): Promise<{ planningRun: PlanningRunSummary; topic: TopicNodeSummary } | null> {
  const client = createInsForgeClient(input.accessToken);

  try {
    const topicResult = await client.database
      .from("topic_nodes")
      .upsert({
        workspace_id: input.workspaceId,
        page_id: input.pageId,
        name: input.plan.targetTitle,
        slug: slugify(input.plan.targetTitle),
        summary: input.plan.reason,
        level: input.plan.targetLevel,
        updated_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,slug" })
      .select("id")
      .single();

    assertNoError("记录主题节点失败", topicResult.error);
    const topicId = (topicResult.data as { id: string }).id;

    const atomResult = await client.database
      .from("knowledge_atoms")
      .insert(input.atoms.map((atom) => ({
        workspace_id: input.workspaceId,
        capture_id: input.captureId,
        topic_id: topicId,
        atom_type: atom.type,
        title: atom.title,
        content: atom.content,
        quote: atom.quote,
        confidence: atom.confidence,
        metadata_json: {},
      })))
      .select("id");

    assertNoError("记录知识原子失败", atomResult.error);
    const atomIds = ((atomResult.data ?? []) as Array<{ id: string }>).map((atom) => atom.id);

    const planningResult = await client.database.from("category_planning_runs").insert({
      workspace_id: input.workspaceId,
      capture_id: input.captureId,
      topic_id: topicId,
      action: input.plan.action,
      target_title: input.plan.targetTitle,
      reason: input.plan.reason,
      confidence: input.plan.confidence,
      atom_ids_json: atomIds,
      recommended_actions_json: {
        action: input.plan.action,
        targetLevel: input.plan.targetLevel,
        targetPageId: input.plan.targetPageId,
      },
      status: "confirmed",
    });

    assertNoError("记录类目规划失败", planningResult.error);

    const synthesisResult = await client.database.from("synthesis_runs").insert({
      workspace_id: input.workspaceId,
      topic_id: topicId,
      page_id: input.pageId,
      capture_id: input.captureId,
      action: input.plan.action,
      status: "confirmed",
      diff_json: {
        targetTitle: input.plan.targetTitle,
        reason: input.plan.reason,
        atomCount: input.atoms.length,
      },
      quality_notes_json: [],
    });

    assertNoError("记录综合运行失败", synthesisResult.error);

    return {
      planningRun: {
        id: `${input.captureId}-${Date.now()}`,
        action: input.plan.action,
        targetTitle: input.plan.targetTitle,
        reason: input.plan.reason,
        confidence: input.plan.confidence,
        atomCount: input.atoms.length,
        status: "confirmed",
        createdAt: formatDate(new Date().toISOString()),
      },
      topic: {
        id: topicId,
        name: input.plan.targetTitle,
        level: input.plan.targetLevel,
        status: "active",
        summary: input.plan.reason,
        pageId: input.pageId,
        atomCount: input.atoms.length,
        updatedAt: formatDate(new Date().toISOString()),
      },
    };
  } catch (error) {
    console.warn("V2 alpha graph tables are unavailable; skipped graph recording.", error);
    return null;
  }
}

async function ensureLibrary(libraryName: string, workspaceId: string, accessToken?: string): Promise<LibraryRef> {
  const client = createInsForgeClient(accessToken);
  const id = `library-${workspaceId}-${libraryName}`;
  const existing = await client.database
    .from("libraries")
    .select("id,name")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  assertNoError("读取知识库失败", existing.error);

  if (existing.data) {
    return existing.data as LibraryRef;
  }

  const created = await client.database
    .from("libraries")
    .insert({
      id,
      workspace_id: workspaceId,
      name: libraryName,
      sort_order: 99,
    })
    .select("id,name")
    .single();

  assertNoError("创建知识库失败", created.error);
  return created.data as LibraryRef;
}

async function ensureFolder(
  library: LibraryRef,
  folderName: string,
  workspaceId: string,
  accessToken?: string,
): Promise<FolderRef> {
  const client = createInsForgeClient(accessToken);
  const id = `folder-${workspaceId}-${library.name}/${folderName}`;
  const existing = await client.database
    .from("folders")
    .select("id,name")
    .eq("id", id)
    .eq("library_id", library.id)
    .maybeSingle();

  assertNoError("读取目录失败", existing.error);

  if (existing.data) {
    return existing.data as FolderRef;
  }

  const created = await client.database
    .from("folders")
    .insert({
      id,
      library_id: library.id,
      name: folderName,
      sort_order: 99,
    })
    .select("id,name")
    .single();

  assertNoError("创建目录失败", created.error);
  return created.data as FolderRef;
}

function assertNoError(message: string, error: unknown) {
  if (error) {
    throw new Error(`${message}: ${getInsForgeErrorMessage(error)}`);
  }
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "page";
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    update_existing_topic: "更新已有主题",
    create_new_topic: "新建主题",
    create_subtopic: "新建子主题",
    merge_with_topic: "合并主题",
    split_into_multiple_topics: "拆分主题",
    append_as_evidence: "作为证据追加",
    archive_as_source_only: "仅归档来源",
    hold_for_more_sources: "暂存等待更多材料",
  };
  return labels[action] ?? action;
}

function buildDraftMarkdown(capture: CaptureDetailRow) {
  const sourceType = normalizeSourceType(capture.source_type);
  const sourceText = capture.selected_text || capture.raw_content;
  const note = capture.note || "后续可以继续补充背景、关联和个人判断。";

  if (sourceType === "web") {
    return [
      `> 解析方式：${parserLabel(sourceType)}`,
      "## 原文摘录",
      sourceText,
      "## 核心观点",
      "这里需要提炼网页正文中的关键判断。",
      "## 我的理解",
      note,
    ].join("\n\n");
  }

  if (sourceType === "video") {
    return [
      `> 解析方式：${parserLabel(sourceType)}`,
      "## 视频信息",
      sourceText,
      "## 时间线要点",
      "后续接入转写后，在这里按时间点整理关键内容。",
      "## 我的理解",
      note,
    ].join("\n\n");
  }

  if (sourceType === "file") {
    return [
      `> 解析方式：${parserLabel(sourceType)}`,
      "## 文件内容",
      sourceText,
      "## 结构化摘要",
      "后续接入文件解析后，在这里抽取标题、章节、表格和关键结论。",
      "## 我的理解",
      note,
    ].join("\n\n");
  }

  return [
    `> 解析方式：${parserLabel(sourceType)}`,
    "## 原始内容",
    sourceText,
    "## 我的理解",
    note,
  ].join("\n\n");
}
