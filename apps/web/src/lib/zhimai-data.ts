export type WikiPage = {
  id: string;
  title: string;
  type: "观点" | "方法" | "产品决策" | "问题" | "模板" | "决策";
  library: string;
  folder: string;
  tags: string[];
  aiState: string;
  updatedAt: string;
  content: string[];
};

export type LibraryTree = {
  name: string;
  folders: string[];
};

export type Capture = {
  id: string;
  title: string;
  source: string;
  sourceType: KnowledgeSourceType;
  parser: string;
  status: "未整理" | "已分析" | "待确认" | "已写入";
  suggestedAction: string;
};

export type KnowledgeSourceType = "text" | "web" | "video" | "file";

export type AppUser = {
  id: string;
  email: string;
  name?: string;
};

export type AiProviderConfig = {
  provider: "openai-compatible" | "openai" | "deepseek" | "moonshot" | "qwen" | "custom";
  baseUrl: string;
  model: string;
  generationPrompt: string;
  keyHint: string;
  isEnabled: boolean;
  updatedAt: string;
};

export const fallbackWikiPages: WikiPage[] = [
  {
    id: "knowledge-restructure",
    title: "知识管理的核心是重构认知结构",
    type: "观点",
    library: "个人 Wiki",
    folder: "知识管理",
    tags: ["知识管理", "个人 Wiki", "认知结构"],
    aiState: "已成文",
    updatedAt: "今天 17:42",
    content: [
      "知识管理的价值不只是保存信息，而是帮助人持续更新自己的理解方式。",
      "收藏解决的是信息留存问题，重构解决的是理解和复用问题。一个好的个人 Wiki 应该把碎片内容转化为稳定页面，并让它和已有知识建立关系。",
      "知脉的 AI 不应该替用户直接决定知识库结构，而应该给出可解释的整理建议，让用户确认后再写入。",
    ],
  },
  {
    id: "processing-desk-layout",
    title: "整理台三栏布局",
    type: "方法",
    library: "知脉产品设计",
    folder: "产品方案",
    tags: ["整理台", "用户确认"],
    aiState: "已关联",
    updatedAt: "今天 16:18",
    content: [
      "整理台采用左侧原文、中间 AI 判断、右侧 Wiki 草稿的三栏结构。",
      "这个布局的关键价值是保留上下文，用户可以同时核对来源、理解 AI 判断，并直接修改 Wiki 草稿。",
      "第一版默认不自动写入 Wiki，所有页面都经过用户确认。",
    ],
  },
  {
    id: "extension-boundary",
    title: "浏览器插件的边界",
    type: "产品决策",
    library: "知脉产品设计",
    folder: "浏览器插件",
    tags: ["插件", "收集箱"],
    aiState: "待补充",
    updatedAt: "昨天 21:09",
    content: [
      "浏览器插件的第一职责是降低收集成本，而不是替代 Web 整理台。",
      "插件只保存当前网页、选中文本和用户备注，然后把内容发送到 Web 收集箱。",
      "复杂整理、页面合并、目录选择和 Wiki 写入都应该留在 Web 端完成。",
    ],
  },
  {
    id: "inbox-status",
    title: "收集箱状态设计",
    type: "方法",
    library: "个人 Wiki",
    folder: "方法沉淀",
    tags: ["收集箱", "状态流转"],
    aiState: "已关联",
    updatedAt: "昨天 18:26",
    content: [
      "收集箱需要区分未整理、已分析、待确认、已写入和已忽略。",
      "状态设计的目标不是复杂管理，而是让用户快速知道哪些碎片还需要处理。",
    ],
  },
  {
    id: "avoid-duplicate-pages",
    title: "如何避免重复创建页面",
    type: "问题",
    library: "AI 资料库",
    folder: "AI 质量",
    tags: ["AI", "重复页面"],
    aiState: "待研究",
    updatedAt: "昨天 11:03",
    content: [
      "AI 写入 Wiki 前应先检索相似页面，并优先建议补充已有页面。",
      "重复页面会让知识库失去结构，因此相似页面检索应该成为整理台的基础能力。",
    ],
  },
  {
    id: "wiki-template",
    title: "Wiki 页面模板",
    type: "模板",
    library: "方法与模板",
    folder: "模板",
    tags: ["模板", "Wiki"],
    aiState: "可复用",
    updatedAt: "07-05 17:20",
    content: [
      "标准页面包含一句话解释、背景、核心观点、详细说明、相关知识和待研究问题。",
      "模板不是为了限制用户，而是为了让知识长期保持可读和可追加。",
    ],
  },
];

export const fallbackCaptures: Capture[] = [
  {
    id: "capture-1",
    title: "知识管理不是收藏",
    source: "手动输入",
    sourceType: "text",
    parser: "文本结构化",
    status: "待确认",
    suggestedAction: "创建新页面",
  },
  {
    id: "capture-2",
    title: "浏览器插件只做收集入口",
    source: "网页摘录",
    sourceType: "web",
    parser: "网页正文解析",
    status: "未整理",
    suggestedAction: "补充已有页面",
  },
  {
    id: "capture-3",
    title: "整理台采用三栏布局",
    source: "产品笔记",
    sourceType: "text",
    parser: "文本结构化",
    status: "已分析",
    suggestedAction: "创建新页面",
  },
];

export const fallbackLibraries: LibraryTree[] = [
  {
    name: "个人 Wiki",
    folders: ["知识管理", "方法沉淀"],
  },
  {
    name: "知脉产品设计",
    folders: ["产品方案", "浏览器插件"],
  },
  {
    name: "AI 资料库",
    folders: ["AI 质量"],
  },
  {
    name: "方法与模板",
    folders: ["模板"],
  },
];

export const fallbackAiConfig: AiProviderConfig | null = null;
