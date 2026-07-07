import { prisma } from "../src/lib/db/prisma";

const defaultUserEmail = "demo@zhimai.local";

const pages = [
  {
    title: "知识管理的核心是重构认知结构",
    slug: "knowledge-restructure",
    type: "观点",
    library: "个人 Wiki",
    folder: "知识管理",
    summary: "知识管理的价值不只是保存信息，而是帮助人持续更新自己的理解方式。",
    content: [
      "知识管理的价值不只是保存信息，而是帮助人持续更新自己的理解方式。",
      "收藏解决的是信息留存问题，重构解决的是理解和复用问题。一个好的个人 Wiki 应该把碎片内容转化为稳定页面，并让它和已有知识建立关系。",
      "知脉的 AI 不应该替用户直接决定知识库结构，而应该给出可解释的整理建议，让用户确认后再写入。",
    ].join("\n\n"),
  },
  {
    title: "整理台三栏布局",
    slug: "processing-desk-layout",
    type: "方法",
    library: "知脉产品设计",
    folder: "产品方案",
    summary: "整理台采用左侧原文、中间 AI 判断、右侧 Wiki 草稿的三栏结构。",
    content: [
      "整理台采用左侧原文、中间 AI 判断、右侧 Wiki 草稿的三栏结构。",
      "这个布局的关键价值是保留上下文，用户可以同时核对来源、理解 AI 判断，并直接修改 Wiki 草稿。",
      "第一版默认不自动写入 Wiki，所有页面都经过用户确认。",
    ].join("\n\n"),
  },
  {
    title: "浏览器插件的边界",
    slug: "extension-boundary",
    type: "产品决策",
    library: "知脉产品设计",
    folder: "浏览器插件",
    summary: "浏览器插件的第一职责是降低收集成本，而不是替代 Web 整理台。",
    content: [
      "浏览器插件的第一职责是降低收集成本，而不是替代 Web 整理台。",
      "插件只保存当前网页、选中文本和用户备注，然后把内容发送到 Web 收集箱。",
      "复杂整理、页面合并、目录选择和 Wiki 写入都应该留在 Web 端完成。",
    ].join("\n\n"),
  },
  {
    title: "收集箱状态设计",
    slug: "inbox-status",
    type: "方法",
    library: "个人 Wiki",
    folder: "方法沉淀",
    summary: "收集箱需要区分未整理、已分析、待确认、已写入和已忽略。",
    content: [
      "收集箱需要区分未整理、已分析、待确认、已写入和已忽略。",
      "状态设计的目标不是复杂管理，而是让用户快速知道哪些碎片还需要处理。",
    ].join("\n\n"),
  },
  {
    title: "如何避免重复创建页面",
    slug: "avoid-duplicate-pages",
    type: "问题",
    library: "AI 资料库",
    folder: "AI 质量",
    summary: "AI 写入 Wiki 前应先检索相似页面，并优先建议补充已有页面。",
    content: [
      "AI 写入 Wiki 前应先检索相似页面，并优先建议补充已有页面。",
      "重复页面会让知识库失去结构，因此相似页面检索应该成为整理台的基础能力。",
    ].join("\n\n"),
  },
  {
    title: "Wiki 页面模板",
    slug: "wiki-template",
    type: "模板",
    library: "方法与模板",
    folder: "模板",
    summary: "标准页面包含一句话解释、背景、核心观点、详细说明、相关知识和待研究问题。",
    content: [
      "标准页面包含一句话解释、背景、核心观点、详细说明、相关知识和待研究问题。",
      "模板不是为了限制用户，而是为了让知识长期保持可读和可追加。",
    ].join("\n\n"),
  },
];

const captures = [
  {
    sourceType: "manual",
    sourceTitle: "知识管理不是收藏",
    rawContent: "未来的知识管理不是保存信息，而是持续重构认知结构。",
    status: "processed",
  },
  {
    sourceType: "web",
    sourceTitle: "浏览器插件只做收集入口",
    sourceUrl: "https://example.com/extension-boundary",
    selectedText: "插件应保持轻量，只负责把网页内容送到收集箱。",
    rawContent: "插件应保持轻量，只负责把网页内容送到收集箱，不承担复杂整理和编辑。",
    status: "pending",
  },
  {
    sourceType: "note",
    sourceTitle: "整理台采用三栏布局",
    rawContent: "三栏布局可以同时呈现原始材料、AI 判断和 Wiki 草稿。",
    status: "processed",
  },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: defaultUserEmail },
    update: {},
    create: {
      email: defaultUserEmail,
      name: "知脉 Demo 用户",
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: "demo-workspace" },
    update: {},
    create: {
      id: "demo-workspace",
      userId: user.id,
      name: "知脉个人空间",
    },
  });

  const libraryRecords = new Map<string, { id: string }>();
  const folderRecords = new Map<string, { id: string }>();

  for (const libraryName of ["个人 Wiki", "知脉产品设计", "AI 资料库", "方法与模板"]) {
    const library = await prisma.library.upsert({
      where: { id: `library-${libraryName}` },
      update: {},
      create: {
        id: `library-${libraryName}`,
        workspaceId: workspace.id,
        name: libraryName,
      },
    });
    libraryRecords.set(libraryName, library);
  }

  for (const page of pages) {
    const library = libraryRecords.get(page.library);
    if (!library) throw new Error(`Missing library: ${page.library}`);

    const folderKey = `${page.library}/${page.folder}`;
    let folder = folderRecords.get(folderKey);

    if (!folder) {
      const createdFolder = await prisma.folder.upsert({
        where: { id: `folder-${folderKey}` },
        update: {},
        create: {
          id: `folder-${folderKey}`,
          libraryId: library.id,
          name: page.folder,
        },
      });
      folderRecords.set(folderKey, createdFolder);
      folder = createdFolder;
    }

    await prisma.wikiPage.upsert({
      where: {
        libraryId_slug: {
          libraryId: library.id,
          slug: page.slug,
        },
      },
      update: {
        title: page.title,
        type: page.type,
        summary: page.summary,
        contentMarkdown: page.content,
      },
      create: {
        workspaceId: workspace.id,
        libraryId: library.id,
        folderId: folder.id,
        title: page.title,
        slug: page.slug,
        type: page.type,
        summary: page.summary,
        contentMarkdown: page.content,
      },
    });
  }

  for (const capture of captures) {
    const existing = await prisma.capture.findFirst({
      where: {
        workspaceId: workspace.id,
        sourceTitle: capture.sourceTitle,
      },
    });

    if (!existing) {
      await prisma.capture.create({
        data: {
          workspaceId: workspace.id,
          ...capture,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
