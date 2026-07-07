# 知脉 2.0 知识图谱方案

## 核心判断

知脉 2.0 不应该把一篇原始材料直接变成一篇 Wiki 页面。

更合理的模型是：

```text
原始材料 -> 知识原子 -> 主题节点 -> 关系网络 -> 综合知识页
```

原始材料是证据和来源，知识原子是可复用的信息单元，主题节点是知识体系的组织骨架，Wiki 页面只是图谱在某一时刻的阅读视图。

例如用户收集了 5 篇分析 Agent 能力的文章，系统不应该生成 5 篇重复页面，而应该持续更新一个主题节点：

```text
Agent 能力体系
```

这个主题页综合 5 篇来源的共识、差异、案例、概念、能力分类和待验证问题，并标注每个判断来自哪些来源。

## 设计目标

2.0 的知识图谱需要解决 5 个问题：

- 避免重复页面
- 把多篇材料整合成主题知识
- 保留来源证据，避免 AI 编造
- 让知识可以持续演进，而不是一次性生成
- 让用户能看懂系统为什么这样归并和改写

## 核心对象

### 1. Source：原始来源

Source 是用户收集的原始材料。

来源类型包括：

- web
- text
- file
- video
- image
- conversation

Source 的职责是保真，不承担知识结构。

关键字段：

```text
id
workspace_id
source_type
title
url
author
published_at
raw_content
extracted_text
user_note
metadata_json
created_at
```

### 2. Knowledge Atom：知识原子

知识原子是从来源中提取出的最小可复用知识单元。

常见类型：

- concept：概念
- claim：观点或判断
- method：方法
- case：案例
- data_point：数据点
- question：问题
- definition：定义
- taxonomy：分类
- risk：风险
- decision：决策

知识原子不是页面，而是图谱中的可移动积木。

关键字段：

```text
id
workspace_id
source_id
atom_type
title
content
quote
confidence
metadata_json
created_at
```

其中 `quote` 保存可回溯的原文片段，`content` 是经过整理后的稳定表达。

### 3. Topic Node：主题节点

主题节点是知识体系的中心。

它可以是：

- 一个概念主题：Agent 能力
- 一个问题主题：如何评估 Agent 是否可靠
- 一个方法主题：AI 产品需求分析方法
- 一个领域主题：个人知识管理

主题节点不是文件夹。文件夹只是展示层，主题节点是知识意义层。

关键字段：

```text
id
workspace_id
name
slug
summary
status
level
aliases_json
tags_json
created_at
updated_at
```

`level` 用来表达主题粒度：

- domain：领域，例如 AI 应用
- topic：主题，例如 Agent 能力
- subtopic：子主题，例如 工具调用能力
- aspect：角度，例如 可靠性评估

### 4. Topic Page：综合知识页

Topic Page 是主题节点的当前阅读版本。

它不是直接由某一个来源生成，而是由多个知识原子综合生成。

关键字段：

```text
id
topic_id
version
title
summary
content_markdown
synthesis_status
created_at
updated_at
```

重要原则：

- 一个主题可以有多个版本
- 每次整合新来源，可以生成一个新的 page version
- 页面内容必须能追溯到知识原子和 Source

### 5. Edge：关系

Edge 描述图谱中的关系。

建议先用关系表，不急着引入 Neo4j。Postgres + pgvector 足够支撑 2.0 初期。

核心关系类型：

```text
source_contains_atom
atom_belongs_to_topic
topic_has_subtopic
atom_supports_atom
atom_contradicts_atom
atom_refines_atom
atom_duplicates_atom
atom_evidences_claim
topic_related_to_topic
page_generated_from_atoms
```

关系字段：

```text
id
workspace_id
from_type
from_id
to_type
to_id
relation_type
reason
confidence
created_by
created_at
```

## 数据层建议

2.0 初期建议仍然使用 Postgres，而不是马上引入图数据库。

原因：

- 当前核心是个人知识系统，规模不会立刻大到图数据库不可替代
- Postgres 更容易和现有 InsForge、Next.js、权限模型衔接
- 关系查询可以先用普通表完成
- 语义相似度可以用 embedding 表补充
- 后续如果需要复杂路径查询，再迁移到专门图数据库

建议新增表：

```text
knowledge_sources
knowledge_atoms
topic_nodes
topic_pages
knowledge_edges
atom_embeddings
topic_embeddings
synthesis_runs
```

### synthesis_runs

每次知识整合都应该被记录，方便审计和回滚。

```text
id
workspace_id
topic_id
input_source_ids_json
input_atom_ids_json
strategy
model
status
diff_json
quality_notes_json
created_at
```

`diff_json` 记录这次综合对主题页做了什么：

- 新增了哪些段落
- 合并了哪些重复观点
- 标记了哪些冲突
- 引入了哪些来源
- 产生了哪些待研究问题

## 内容生产流程

### 阶段 1：来源解析

输入一篇来源材料后，系统先提取可处理文本。

```text
Source
  -> extract text
  -> clean text
  -> chunk text
  -> source profile
```

source profile 包括：

- 主要主题
- 来源类型
- 内容可信度线索
- 适合提取的知识类型

### 阶段 2：知识原子提取

AI 不直接写 Wiki，而是先输出知识原子。

示例输出：

```json
{
  "atoms": [
    {
      "type": "claim",
      "title": "Agent 的核心能力不只是调用工具",
      "content": "Agent 能力应同时包含目标分解、工具调用、状态记忆和反馈修正。",
      "quote": "Agent capability is not merely tool use...",
      "confidence": 0.82
    }
  ]
}
```

这一阶段的质量标准：

- 每个原子都要有来源
- 不把长摘要当成原子
- 一个原子只表达一个知识点
- 明确区分事实、观点、方法、案例、问题

### 阶段 3：主题匹配

系统判断每个知识原子属于哪个主题节点。

匹配顺序：

1. 标题、别名、标签精确匹配
2. embedding 相似度召回候选主题
3. AI 判断是否属于已有主题
4. 如果没有合适主题，再建议创建新主题

输出不是直接写入，而是候选建议：

```json
{
  "atom_id": "atom_123",
  "candidate_topics": [
    {
      "topic": "Agent 能力体系",
      "confidence": 0.91,
      "reason": "该观点讨论 Agent 的能力构成，与主题核心一致。"
    }
  ],
  "suggested_action": "attach_to_existing_topic"
}
```

### 阶段 4：重复、补充、冲突判断

在写入主题前，系统要判断新知识原子和已有原子的关系。

关系判断：

- duplicate：表达重复
- supplement：补充细节
- refine：修正或精炼
- contradiction：冲突或不同立场
- example：提供案例
- evidence：提供证据
- open_question：提出问题

这一步决定内容生产质量。

如果 5 篇 Agent 文章都说“工具调用是 Agent 能力之一”，系统应该合并为一个共识，而不是重复写 5 次。

### 阶段 5：主题页综合

主题页生成不是摘要，而是综合。

综合输入：

- 当前主题页
- 已确认知识原子
- 新增知识原子
- 原子之间关系
- 来源证据
- 用户写作偏好
- 主题页模板

综合输出：

```json
{
  "synthesis_action": "update_topic_page",
  "page_title": "Agent 能力体系",
  "sections": [
    {
      "title": "能力总览",
      "change_type": "rewrite",
      "reason": "新增来源补充了记忆和反馈修正能力。"
    },
    {
      "title": "工具调用能力",
      "change_type": "merge",
      "reason": "多个来源重复讨论工具调用，合并为一个共识段落。"
    }
  ],
  "conflicts": [
    {
      "topic": "Agent 是否必须具备长期记忆",
      "positions": ["必须", "可选"],
      "suggested_handling": "保留为分歧观点"
    }
  ],
  "open_questions": [
    "如何区分工作流自动化和真正 Agent？"
  ]
}
```

### 阶段 6：用户确认

用户确认的对象不应该只是“生成的一篇文章”，而应该是这次图谱更新。

整理台需要展示：

- 新来源
- 提取出的知识原子
- 推荐挂载的主题
- 与已有原子的重复、补充、冲突关系
- 主题页更新 diff
- 相关来源证据

用户可以选择：

- 接受本次主题更新
- 只接受部分知识原子
- 改挂到其他主题
- 创建新主题
- 标记为重复
- 标记为低价值来源
- 暂存等待更多材料

## 主题页结构

以「Agent 能力体系」为例，主题页可以采用这种结构：

```text
# Agent 能力体系

## 一句话解释

## 当前结论

## 能力地图

### 目标理解与任务分解

### 规划与步骤生成

### 工具调用

### 记忆与上下文管理

### 环境感知与执行

### 反馈、自检与修正

### 多 Agent 协作

## 共识观点

## 分歧观点

## 典型案例

## 判断标准

## 待研究问题

## 来源材料
```

页面需要保留两类引用：

- 段落级引用：这个段落来自哪些知识原子
- 来源级引用：这些原子来自哪些原始材料

## 用户界面设计

### 收集箱

收集箱不再只显示“待整理文章”，而是显示来源的处理状态：

- 未解析
- 已提取原子
- 已匹配主题
- 待确认图谱更新
- 已归档为来源

### 整理台

整理台从 1.0 的三栏升级为四个区块：

```text
来源材料
知识原子
主题归并
主题页更新
```

关键交互：

- 用户可以勾选哪些原子进入图谱
- 用户可以拖动原子到其他主题
- 用户可以合并重复原子
- 用户可以确认或拒绝冲突标记
- 用户可以查看每段生成内容的来源

### 知识库

知识库不只是页面列表，而是主题空间：

- 主题树
- 主题页
- 相关主题
- 来源材料
- 主题演进记录

### 脉图

脉图第一版不需要复杂可视化。

先做 3 个实用视图：

- 主题关系：主题和子主题
- 来源贡献：哪些来源贡献了这个主题
- 分歧视图：某主题下有哪些冲突观点

## 图谱更新策略

### 自动与人工边界

AI 可以自动做：

- 提取知识原子
- 推荐主题
- 推荐关系
- 生成更新 diff
- 发现重复和冲突

用户需要确认：

- 新建主题
- 合并主题
- 更新正式主题页
- 删除或覆盖已有结论
- 接受有争议的判断

### 避免知识污染

必须保留：

- 来源证据
- 更新 diff
- 版本历史
- 用户确认记录
- 回滚能力

AI 不能直接覆盖主题页，只能生成一次 `synthesis_run`，等待用户确认。

## 技术实现阶段

### 2.0-alpha：主题归并

目标：解决“一篇来源一篇页面”的问题。

实现：

- 新增 topic_nodes
- 新增 knowledge_atoms
- 新增 atom_to_topic 关系
- 整理台展示原子和推荐主题
- 用户确认后把多个来源归并到一个主题页

暂不做复杂图谱可视化。

### 2.0-beta：综合重写

目标：让主题页能根据新增来源持续演进。

实现：

- 新增 synthesis_runs
- 生成主题页 diff
- 支持主题页版本
- 支持来源引用
- 支持重复和补充判断

### 2.0-stable：关系网络

目标：形成真正的知识网络。

实现：

- topic_has_subtopic
- atom_supports_atom
- atom_contradicts_atom
- topic_related_to_topic
- 主题关系视图
- 分歧观点视图

### 2.1：高级图谱

目标：在规模增长后提升检索和推理能力。

可选：

- pgvector 语义召回
- 图路径查询
- 自动主题聚类
- 主题合并建议
- Neo4j 或其他图数据库评估

## 与 1.0 的关系

1.0 的 Wiki 页面模型可以保留，但语义上需要降级为展示层。

原来的：

```text
capture -> processing_result -> wiki_page
```

2.0 升级为：

```text
source -> knowledge_atoms -> topic_node -> topic_page
```

旧的 `wiki_pages` 可以逐步迁移成 `topic_pages`：

- 每个已有 Wiki 页面先生成一个 topic_node
- 页面正文拆解成 knowledge_atoms
- 页面之间的 page_links 迁移为 knowledge_edges
- 后续再合并重复主题

## 成功标准

2.0 不用页面数量衡量成功，而用知识整合质量衡量。

关键指标：

- 相似来源是否被合并到同一主题
- 主题页是否随着来源增加变得更深，而不是更乱
- 用户是否能看出新增来源贡献了什么
- 重复观点是否被合并
- 分歧观点是否被保留而不是抹平
- 每个结论是否能追溯来源
- 用户是否愿意把更多材料交给系统持续维护

## 产品定位升级

1.0：

```text
把碎片整理成 Wiki
```

2.0：

```text
把来源材料持续重构成个人知识图谱
```

更准确的一句话：

```text
知脉不是帮你生成更多文档，而是帮你维护一个会持续变深的知识体系。
```

