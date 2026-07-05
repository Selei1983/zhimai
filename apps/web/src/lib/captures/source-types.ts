import type { KnowledgeSourceType } from "@/lib/zhimai-data";

export const sourceTypeOptions: Array<{
  value: KnowledgeSourceType;
  label: string;
  parser: string;
  placeholder: string;
}> = [
  {
    value: "text",
    label: "文本",
    parser: "文本结构化",
    placeholder: "粘贴想法、摘录、聊天记录或文章片段。",
  },
  {
    value: "web",
    label: "网页",
    parser: "网页正文解析",
    placeholder: "粘贴网页链接、标题或关键摘录。",
  },
  {
    value: "video",
    label: "视频",
    parser: "视频转写解析",
    placeholder: "粘贴视频链接、字幕、时间点或你的观看笔记。",
  },
  {
    value: "file",
    label: "文件",
    parser: "文件内容抽取",
    placeholder: "上传文件后，知脉会先记录文件信息并准备解析。",
  },
];

const legacySourceTypeMap: Record<string, KnowledgeSourceType> = {
  manual: "text",
  note: "text",
  text: "text",
  web: "web",
  webpage: "web",
  video: "video",
  file: "file",
  document: "file",
  pdf: "file",
};

export function normalizeSourceType(value?: string | null): KnowledgeSourceType {
  return legacySourceTypeMap[(value || "").trim().toLowerCase()] ?? "text";
}

export function sourceLabel(value?: string | null) {
  const sourceType = normalizeSourceType(value);
  return sourceTypeOptions.find((option) => option.value === sourceType)?.label ?? "文本";
}

export function parserLabel(value?: string | null) {
  const sourceType = normalizeSourceType(value);
  return sourceTypeOptions.find((option) => option.value === sourceType)?.parser ?? "文本结构化";
}
