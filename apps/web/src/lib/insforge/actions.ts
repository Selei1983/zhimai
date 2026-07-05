import { createInsForgeClient } from "@/lib/insforge/client";
import { generateWikiDraft } from "@/lib/ai/wiki-draft";
import { normalizeSourceType, parserLabel } from "@/lib/captures/source-types";
import {
  getInsForgeErrorMessage,
  type InsForgeCaptureRow,
  type InsForgePageRow,
  toCapture,
  toWikiPage,
} from "@/lib/insforge/mappers";

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
  const title = capture.source_title ?? capture.raw_content.slice(0, 24);
  const contentMarkdown =
    (await generateWikiDraft({
      accessToken,
      note: capture.note,
      rawContent: capture.raw_content,
      selectedText: capture.selected_text,
      sourceTitle: capture.source_title,
      sourceType: capture.source_type,
      workspaceId,
    }).catch((error) => {
      console.warn("AI draft generation failed, falling back to template.", error);
      return null;
    })) ?? buildDraftMarkdown(capture);

  const pageResult = await client.database
    .from("wiki_pages")
    .insert({
      workspace_id: workspaceId,
      library_id: library.id,
      folder_id: folder.id,
      title,
      slug: `${slugify(title)}-${Date.now()}`,
      type: "观点",
      summary: capture.raw_content.slice(0, 120),
      content_markdown: contentMarkdown,
    })
    .select(pageSelect)
    .single();

  assertNoError("从收集箱生成 Wiki 页面失败", pageResult.error);
  const page = pageResult.data as InsForgePageRow;

  const sourceResult = await client.database.from("page_sources").insert({
    page_id: page.id,
    capture_id: capture.id,
    quote: capture.selected_text ?? capture.raw_content.slice(0, 200),
    note: "由收集箱生成",
  });
  assertNoError("记录页面来源失败", sourceResult.error);

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
    page: toWikiPage(page),
  };
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
