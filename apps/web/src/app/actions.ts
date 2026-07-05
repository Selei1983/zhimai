"use server";

import { revalidatePath } from "next/cache";
import { saveAiProviderConfig, testAiProviderConnection, type AiProviderInput } from "@/lib/ai/config";
import { shouldUseInsForge, workspaceId } from "@/lib/backend";
import { normalizeSourceType, parserLabel, sourceLabel } from "@/lib/captures/source-types";
import { prisma } from "@/lib/db/prisma";
import {
  createInsForgeCapture,
  createInsForgeWikiPage,
  createInsForgeWikiPageFromCapture,
  updateInsForgeWikiPage,
} from "@/lib/insforge/actions";
import { getUserWorkspaceContext } from "@/lib/insforge/workspace";
import type { Capture, KnowledgeSourceType, WikiPage } from "@/lib/zhimai-data";

export async function saveAiConfig(input: AiProviderInput, accessToken?: string) {
  if (!shouldUseInsForge()) {
    throw new Error("当前本地数据库模式暂未启用 AI 配置保存");
  }

  const context = await getUserWorkspaceContext(accessToken);
  const config = await saveAiProviderConfig(input, context.workspaceId, context.accessToken);
  revalidatePath("/");
  return config;
}

export async function testAiConfig(input: AiProviderInput, accessToken?: string) {
  if (!shouldUseInsForge()) {
    throw new Error("当前本地数据库模式暂未启用 AI 配置测试");
  }

  const context = await getUserWorkspaceContext(accessToken);
  return testAiProviderConnection(input, context.workspaceId, context.accessToken);
}

export async function createWikiPage(input: {
  title?: string;
  libraryName: string;
  folderName: string;
}, accessToken?: string) {
  if (shouldUseInsForge()) {
    const context = await getUserWorkspaceContext(accessToken);
    const page = await createInsForgeWikiPage(input, context.workspaceId, context.accessToken);
    revalidatePath("/");
    return page;
  }

  const title = input.title?.trim() || "未命名页面";
  const library = await prisma.library.upsert({
    where: { id: `library-${input.libraryName}` },
    update: {},
    create: {
      id: `library-${input.libraryName}`,
      workspaceId,
      name: input.libraryName,
    },
  });

  const folderKey = `${input.libraryName}/${input.folderName}`;
  const folder = await prisma.folder.upsert({
    where: { id: `folder-${folderKey}` },
    update: {},
    create: {
      id: `folder-${folderKey}`,
      libraryId: library.id,
      name: input.folderName,
    },
  });

  const page = await prisma.wikiPage.create({
    data: {
      workspaceId,
      libraryId: library.id,
      folderId: folder.id,
      title,
      slug: `${slugify(title)}-${Date.now()}`,
      type: "观点",
      summary: "新建 Wiki 页面",
      contentMarkdown: "这里开始整理你的知识。",
    },
    include: {
      library: true,
      folder: true,
    },
  });

  revalidatePath("/");

  return toWikiPage(page);
}

export async function updateWikiPage(input: {
  id: string;
  title: string;
  contentMarkdown: string;
}, accessToken?: string) {
  if (shouldUseInsForge()) {
    const context = await getUserWorkspaceContext(accessToken);
    const page = await updateInsForgeWikiPage(input, context.workspaceId, context.accessToken);
    revalidatePath("/");
    return page;
  }

  const title = input.title.trim();
  const contentMarkdown = input.contentMarkdown.trim();

  if (!title) {
    throw new Error("标题不能为空");
  }

  if (!contentMarkdown) {
    throw new Error("正文不能为空");
  }

  const page = await prisma.wikiPage.update({
    where: {
      id: input.id,
      workspaceId,
    },
    data: {
      title,
      contentMarkdown,
    },
    include: {
      library: true,
      folder: true,
    },
  });

  await prisma.pageVersion.create({
    data: {
      pageId: page.id,
      contentMarkdown,
      changeNote: "手动编辑保存",
    },
  });

  revalidatePath("/");

  return toWikiPage(page);
}

export async function createCapture(
  input: { rawContent: string; note?: string; sourceTitle?: string; sourceType?: KnowledgeSourceType },
  accessToken?: string,
) {
  if (shouldUseInsForge()) {
    const context = await getUserWorkspaceContext(accessToken);
    const capture = await createInsForgeCapture(input, context.workspaceId, context.accessToken);
    revalidatePath("/");
    return capture;
  }

  const rawContent = input.rawContent.trim();
  const note = input.note?.trim();

  if (!rawContent) {
    throw new Error("收集内容不能为空");
  }

  const capture = await prisma.capture.create({
    data: {
      workspaceId,
      sourceType: input.sourceType ?? "text",
      sourceTitle: input.sourceTitle?.trim() || rawContent.split(/\n/)[0].slice(0, 40),
      rawContent,
      note,
      status: "pending",
    },
  });

  revalidatePath("/");

  return toCapture(capture);
}

export async function createWikiPageFromCapture(input: { captureId: string }, accessToken?: string) {
  if (shouldUseInsForge()) {
    const context = await getUserWorkspaceContext(accessToken);
    const result = await createInsForgeWikiPageFromCapture(input, context.workspaceId, context.accessToken);
    revalidatePath("/");
    return result;
  }

  const capture = await prisma.capture.findFirst({
    where: {
      id: input.captureId,
      workspaceId,
    },
  });

  if (!capture) {
    throw new Error("未找到收集内容");
  }

  const library = await prisma.library.upsert({
    where: { id: "library-个人 Wiki" },
    update: {},
    create: {
      id: "library-个人 Wiki",
      workspaceId,
      name: "个人 Wiki",
    },
  });

  const folder = await prisma.folder.upsert({
    where: { id: "folder-个人 Wiki/知识管理" },
    update: {},
    create: {
      id: "folder-个人 Wiki/知识管理",
      libraryId: library.id,
      name: "知识管理",
    },
  });

  const title = capture.sourceTitle ?? capture.rawContent.slice(0, 24);
  const contentMarkdown = buildDraftMarkdown({
    note: capture.note,
    rawContent: capture.rawContent,
    selectedText: capture.selectedText,
    sourceType: capture.sourceType,
  });

  const page = await prisma.wikiPage.create({
    data: {
      workspaceId,
      libraryId: library.id,
      folderId: folder.id,
      title,
      slug: `${slugify(title)}-${Date.now()}`,
      type: "观点",
      summary: capture.rawContent.slice(0, 120),
      contentMarkdown,
      sources: {
        create: {
          captureId: capture.id,
          quote: capture.selectedText ?? capture.rawContent.slice(0, 200),
          note: "由收集箱生成",
        },
      },
    },
    include: {
      library: true,
      folder: true,
    },
  });

  const updatedCapture = await prisma.capture.update({
    where: {
      id: capture.id,
      workspaceId,
    },
    data: {
      status: "confirmed",
    },
  });

  revalidatePath("/");

  return {
    capture: toCapture(updatedCapture),
    page: toWikiPage(page),
  };
}

function toWikiPage(page: {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: Date;
  contentMarkdown: string;
  library: { name: string };
  folder: { name: string } | null;
}): WikiPage {
  return {
    id: page.id,
    title: page.title,
    type: toWikiType(page.type),
    library: page.library.name,
    folder: page.folder?.name ?? "未归档",
    tags: [page.type, page.library.name, page.folder?.name].filter(Boolean) as string[],
    aiState: page.status === "published" ? "已成文" : "草稿",
    updatedAt: formatDate(page.updatedAt),
    content: page.contentMarkdown.split(/\n{2,}/).filter(Boolean),
  };
}

function toWikiType(type: string): WikiPage["type"] {
  if (["观点", "方法", "产品决策", "问题", "模板", "决策"].includes(type)) {
    return type as WikiPage["type"];
  }
  return "观点";
}

function toCapture(capture: {
  id: string;
  sourceType: string;
  sourceTitle: string | null;
  status: string;
}): Capture {
  return {
    id: capture.id,
    title: capture.sourceTitle ?? "未命名收集",
    source: sourceLabel(capture.sourceType),
    sourceType: normalizeSourceType(capture.sourceType),
    parser: parserLabel(capture.sourceType),
    status: captureStatus(capture.status),
    suggestedAction: capture.status === "pending" ? pendingAction(normalizeSourceType(capture.sourceType)) : "确认写入",
  };
}

function captureStatus(status: string): Capture["status"] {
  const labels: Record<string, Capture["status"]> = {
    pending: "未整理",
    processing: "已分析",
    processed: "待确认",
    confirmed: "已写入",
  };
  return labels[status] ?? "未整理";
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "page";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pendingAction(sourceType: Capture["sourceType"]) {
  const actions: Record<Capture["sourceType"], string> = {
    text: "结构化整理",
    web: "解析网页正文",
    video: "提取转写要点",
    file: "抽取文件内容",
  };
  return actions[sourceType];
}

function buildDraftMarkdown(capture: {
  rawContent: string;
  note: string | null;
  selectedText: string | null;
  sourceType: string;
}) {
  const sourceType = normalizeSourceType(capture.sourceType);
  const sourceText = capture.selectedText || capture.rawContent;
  const note = capture.note || "后续可以继续补充背景、关联和个人判断。";

  if (sourceType === "web") {
    return [`> 解析方式：${parserLabel(sourceType)}`, "## 原文摘录", sourceText, "## 核心观点", "这里需要提炼网页正文中的关键判断。", "## 我的理解", note].join("\n\n");
  }

  if (sourceType === "video") {
    return [`> 解析方式：${parserLabel(sourceType)}`, "## 视频信息", sourceText, "## 时间线要点", "后续接入转写后，在这里按时间点整理关键内容。", "## 我的理解", note].join("\n\n");
  }

  if (sourceType === "file") {
    return [`> 解析方式：${parserLabel(sourceType)}`, "## 文件内容", sourceText, "## 结构化摘要", "后续接入文件解析后，在这里抽取标题、章节、表格和关键结论。", "## 我的理解", note].join("\n\n");
  }

  return [`> 解析方式：${parserLabel(sourceType)}`, "## 原始内容", sourceText, "## 我的理解", note].join("\n\n");
}
