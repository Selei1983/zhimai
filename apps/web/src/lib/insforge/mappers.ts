import type { Capture, WikiPage } from "@/lib/zhimai-data";
import { normalizeSourceType, parserLabel, sourceLabel } from "@/lib/captures/source-types";

export type InsForgeLibraryRow = {
  id: string;
  name: string;
  sort_order: number;
  folders?: Array<{
    id: string;
    name: string;
    sort_order: number;
  }>;
};

export type InsForgePageRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  updated_at: string;
  content_markdown: string;
  libraries: RelationName;
  folders: RelationName;
};

export type InsForgeCaptureRow = {
  id: string;
  source_type: string;
  source_title: string | null;
  status: string;
};

type RelationName = { name: string } | Array<{ name: string }> | null;

export function toWikiPage(page: InsForgePageRow): WikiPage {
  const libraryName = getRelationName(page.libraries) ?? "未归档";
  const folderName = getRelationName(page.folders) ?? "未归档";

  return {
    id: page.id,
    title: page.title,
    type: toWikiType(page.type),
    library: libraryName,
    folder: folderName,
    tags: [page.type, libraryName, folderName].filter(Boolean),
    aiState: page.status === "published" ? "已成文" : "草稿",
    updatedAt: formatDate(page.updated_at),
    content: page.content_markdown.split(/\n{2,}/).filter(Boolean),
  };
}

function getRelationName(value: RelationName) {
  if (Array.isArray(value)) {
    return value[0]?.name;
  }
  return value?.name;
}

export function toCapture(capture: InsForgeCaptureRow): Capture {
  const sourceType = normalizeSourceType(capture.source_type);
  return {
    id: capture.id,
    title: capture.source_title ?? "未命名收集",
    source: sourceLabel(capture.source_type),
    sourceType,
    parser: parserLabel(capture.source_type),
    status: captureStatus(capture.status),
    suggestedAction: capture.status === "pending" ? pendingAction(sourceType) : "确认写入",
  };
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

export function toWikiType(type: string): WikiPage["type"] {
  if (["观点", "方法", "产品决策", "问题", "模板", "决策"].includes(type)) {
    return type as WikiPage["type"];
  }
  return "观点";
}

export function captureStatus(status: string): Capture["status"] {
  const labels: Record<string, Capture["status"]> = {
    pending: "未整理",
    processing: "已分析",
    processed: "待确认",
    confirmed: "已写入",
  };
  return labels[status] ?? "未整理";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getInsForgeErrorMessage(error: unknown) {
  if (!error) return "未知错误";
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return JSON.stringify(error);
}
