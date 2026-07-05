insert into wiki_pages (
  workspace_id,
  library_id,
  folder_id,
  title,
  slug,
  type,
  summary,
  content_markdown
) values
  (
    'demo-workspace',
    'library-个人 Wiki',
    'folder-个人 Wiki/知识管理',
    '知识管理的核心是重构认知结构',
    'knowledge-restructure',
    '观点',
    '知识管理的价值不只是保存信息，而是帮助人持续更新自己的理解方式。',
    '知识管理的价值不只是保存信息，而是帮助人持续更新自己的理解方式。

收藏解决的是信息留存问题，重构解决的是理解和复用问题。一个好的个人 Wiki 应该把碎片内容转化为稳定页面，并让它和已有知识建立关系。

知脉的 AI 不应该替用户直接决定知识库结构，而应该给出可解释的整理建议，让用户确认后再写入。'
  ),
  (
    'demo-workspace',
    'library-知脉产品设计',
    'folder-知脉产品设计/产品方案',
    '整理台三栏布局',
    'processing-desk-layout',
    '方法',
    '整理台采用左侧原文、中间 AI 判断、右侧 Wiki 草稿的三栏结构。',
    '整理台采用左侧原文、中间 AI 判断、右侧 Wiki 草稿的三栏结构。

这个布局的关键价值是保留上下文，用户可以同时核对来源、理解 AI 判断，并直接修改 Wiki 草稿。

第一版默认不自动写入 Wiki，所有页面都经过用户确认。'
  ),
  (
    'demo-workspace',
    'library-知脉产品设计',
    'folder-知脉产品设计/浏览器插件',
    '浏览器插件的边界',
    'extension-boundary',
    '产品决策',
    '浏览器插件的第一职责是降低收集成本，而不是替代 Web 整理台。',
    '浏览器插件的第一职责是降低收集成本，而不是替代 Web 整理台。

插件只保存当前网页、选中文本和用户备注，然后把内容发送到 Web 收集箱。

复杂整理、页面合并、目录选择和 Wiki 写入都应该留在 Web 端完成。'
  ),
  (
    'demo-workspace',
    'library-个人 Wiki',
    'folder-个人 Wiki/方法沉淀',
    '收集箱状态设计',
    'inbox-status',
    '方法',
    '收集箱需要区分未整理、已分析、待确认、已写入和已忽略。',
    '收集箱需要区分未整理、已分析、待确认、已写入和已忽略。

状态设计的目标不是复杂管理，而是让用户快速知道哪些碎片还需要处理。'
  ),
  (
    'demo-workspace',
    'library-AI 资料库',
    'folder-AI 资料库/AI 质量',
    '如何避免重复创建页面',
    'avoid-duplicate-pages',
    '问题',
    'AI 写入 Wiki 前应先检索相似页面，并优先建议补充已有页面。',
    'AI 写入 Wiki 前应先检索相似页面，并优先建议补充已有页面。

重复页面会让知识库失去结构，因此相似页面检索应该成为整理台的基础能力。'
  ),
  (
    'demo-workspace',
    'library-方法与模板',
    'folder-方法与模板/模板',
    'Wiki 页面模板',
    'wiki-template',
    '模板',
    '标准页面包含一句话解释、背景、核心观点、详细说明、相关知识和待研究问题。',
    '标准页面包含一句话解释、背景、核心观点、详细说明、相关知识和待研究问题。

模板不是为了限制用户，而是为了让知识长期保持可读和可追加。'
  )
on conflict (library_id, slug) do update set
  folder_id = excluded.folder_id,
  title = excluded.title,
  type = excluded.type,
  summary = excluded.summary,
  content_markdown = excluded.content_markdown,
  updated_at = now();

insert into captures (
  workspace_id,
  source_type,
  source_title,
  source_url,
  selected_text,
  raw_content,
  status
)
select
  'demo-workspace',
  'manual',
  '知识管理不是收藏',
  null,
  null,
  '未来的知识管理不是保存信息，而是持续重构认知结构。',
  'processed'
where not exists (
  select 1 from captures where workspace_id = 'demo-workspace' and source_title = '知识管理不是收藏'
);

insert into captures (
  workspace_id,
  source_type,
  source_title,
  source_url,
  selected_text,
  raw_content,
  status
)
select
  'demo-workspace',
  'web',
  '浏览器插件只做收集入口',
  'https://example.com/extension-boundary',
  '插件应保持轻量，只负责把网页内容送到收集箱。',
  '插件应保持轻量，只负责把网页内容送到收集箱，不承担复杂整理和编辑。',
  'pending'
where not exists (
  select 1 from captures where workspace_id = 'demo-workspace' and source_title = '浏览器插件只做收集入口'
);

insert into captures (
  workspace_id,
  source_type,
  source_title,
  source_url,
  selected_text,
  raw_content,
  status
)
select
  'demo-workspace',
  'note',
  '整理台采用三栏布局',
  null,
  null,
  '三栏布局可以同时呈现原始材料、AI 判断和 Wiki 草稿。',
  'processed'
where not exists (
  select 1 from captures where workspace_id = 'demo-workspace' and source_title = '整理台采用三栏布局'
);
