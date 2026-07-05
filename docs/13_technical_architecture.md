# 知脉技术架构设计

## 架构目标

知脉第一阶段的技术目标不是做一个复杂平台，而是稳定跑通核心闭环：

> 浏览器插件或 Web 输入 -> 收集箱 -> AI 整理 -> 用户确认 -> Wiki 页面 -> 目录树与关联检索

架构需要满足：

- Web 优先
- 插件轻量
- AI 流程可替换
- 知识数据可迁移
- Markdown 友好
- 后续可封装桌面客户端
- 先支持个人使用，再考虑团队协作

## 推荐技术栈

### 第一版建议

- 前端：Next.js + React + TypeScript
- 样式：Tailwind CSS 或 CSS Modules
- 后端：Next.js Route Handlers 或独立 Node.js API
- 数据库：PostgreSQL
- ORM：Prisma
- 向量检索：pgvector
- 队列：BullMQ + Redis，或先用数据库任务表
- AI：OpenAI Responses API
- 鉴权：Auth.js 或 Supabase Auth
- 浏览器插件：Chrome Extension Manifest V3
- Markdown：数据库存 Markdown，支持导出文件
- 部署：Vercel + managed Postgres，或 Docker + VPS

### 第一版更稳的选择

如果希望尽快做出来，建议：

```text
Next.js 全栈应用
PostgreSQL + Prisma
pgvector
OpenAI API
Chrome Extension
```

这样可以减少服务数量，先把产品闭环跑通。

## 总体架构

```text
┌──────────────────────┐
│ Browser Extension    │
│ 选中内容 / 当前网页   │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Web App              │
│ 工作台 / 整理台 / Wiki │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ API Layer            │
│ Capture / Wiki / AI  │
└──────┬────────┬──────┘
       │        │
       v        v
┌──────────┐  ┌─────────────────┐
│ Postgres │  │ AI Worker        │
│ 结构数据  │  │ 整理 / 成文 / 关联 │
└────┬─────┘  └────────┬────────┘
     │                 │
     v                 v
┌──────────┐  ┌─────────────────┐
│ pgvector │  │ Markdown Export  │
│ 语义检索  │  │ 导出 / 客户端同步  │
└──────────┘  └─────────────────┘
```

## 系统分层

### 1. 表现层

包含：

- Web App
- 浏览器插件
- 后续桌面客户端

职责：

- 内容输入
- 收集箱处理
- 整理台确认
- 目录树浏览
- Wiki 阅读和编辑

### 2. 业务 API 层

职责：

- 鉴权
- 用户空间隔离
- 收集内容创建
- AI 任务创建
- Wiki 页面创建和更新
- 目录树维护
- 标签和关联管理
- 搜索接口

### 3. AI 编排层

职责：

- 内容理解
- 类型判断
- Wiki 草稿生成
- 相似页面检索
- 关联推荐
- 页面合并建议
- 质量检查

AI 编排层应该和具体模型解耦，避免后续换模型时大改业务逻辑。

### 4. 数据层

职责：

- 结构化数据保存
- Markdown 内容保存
- 来源材料保存
- 页面版本保存
- 向量索引保存
- 关联关系保存

## 核心数据模型

### users

用户。

```text
id
email
name
avatar_url
created_at
updated_at
```

### workspaces

个人空间。第一版可以每个用户默认一个空间。

```text
id
user_id
name
created_at
updated_at
```

### libraries

知识库，例如个人 Wiki、知脉产品设计、AI 资料库。

```text
id
workspace_id
name
description
icon
sort_order
created_at
updated_at
```

### folders

知识库目录树。

```text
id
library_id
parent_id
name
sort_order
created_at
updated_at
```

### captures

原始收集内容。

```text
id
workspace_id
user_id
source_type
source_title
source_url
selected_text
raw_content
note
status
created_at
updated_at
```

status 建议：

- pending
- processing
- processed
- confirmed
- ignored
- failed

### processing_results

AI 整理结果。

```text
id
capture_id
model
summary
content_type
topics_json
suggested_action
suggested_title
key_points_json
wiki_draft_markdown
related_pages_json
quality_notes_json
created_at
```

### wiki_pages

正式 Wiki 页面。

```text
id
workspace_id
library_id
folder_id
title
slug
type
summary
content_markdown
status
created_by
created_at
updated_at
```

status 建议：

- draft
- published
- archived

### page_versions

页面历史版本。

```text
id
page_id
content_markdown
change_note
created_by
created_at
```

### page_sources

页面和原始材料的关系。

```text
id
page_id
capture_id
quote
note
created_at
```

### page_links

页面之间的知识关联。

```text
id
workspace_id
from_page_id
to_page_id
relation_type
reason
confidence
created_at
```

relation_type 建议：

- parent
- child
- related
- contrast
- example
- method
- source

### embeddings

语义检索索引。

```text
id
workspace_id
object_type
object_id
chunk_index
content
embedding
created_at
```

object_type 可以是：

- capture
- wiki_page
- page_chunk

## 核心流程

## 流程 1：Web 手动输入

```text
用户输入内容
  -> POST /api/captures
  -> 创建 capture
  -> POST /api/captures/:id/process
  -> AI 生成 processing_result
  -> 整理台展示草稿
  -> 用户确认
  -> 创建或更新 wiki_page
  -> 写入 page_sources
  -> 写入 page_links
  -> 生成 embedding
```

## 流程 2：浏览器插件收集

```text
用户选中文本或保存网页
  -> 插件读取 title/url/selectedText
  -> POST /api/extension/captures
  -> 创建 capture
  -> 返回 capture_id
  -> 用户可选择打开 Web 整理台
```

插件第一版不直接调用 AI，避免插件复杂化。

## 流程 3：AI 整理

```text
读取 capture
  -> 检索相似 wiki_pages
  -> 构造 AI 输入
  -> 输出结构化 JSON
  -> 保存 processing_result
  -> 整理台展示
```

AI 输入需要包括：

- 原始内容
- 用户备注
- 相似页面标题和摘要
- 当前知识库目录
- 页面模板约束

AI 输出需要包括：

- 摘要
- 内容类型
- 推荐动作
- 推荐标题
- Wiki 草稿
- 推荐目录
- 关联页面
- 质量提示

## 流程 4：用户确认写入

```text
用户点击写入 Wiki
  -> 选择新建或更新页面
  -> 保存 Markdown
  -> 保存版本
  -> 保存来源
  -> 保存关联
  -> 更新向量索引
```

第一版必须保留用户确认，避免 AI 自动污染知识库。

## AI 架构

### AI 不直接写数据库

AI 只返回建议和草稿。

业务服务负责：

- 校验 JSON
- 落库
- 建立来源关系
- 更新版本
- 写入关联

### AI 任务类型

建议拆成四类：

1. analyze_capture  
   分析输入内容。

2. draft_wiki_page  
   生成 Wiki 草稿。

3. suggest_links  
   推荐关联页面。

4. merge_into_page  
   建议如何补充已有页面。

第一版可以先合并为一个接口，后续再拆。

### 质量控制

需要做：

- JSON schema 校验
- Markdown 长度限制
- 来源引用检查
- 相似页面重复检查
- 模型输出日志
- 失败重试

## 搜索与关联

### 第一版搜索

先做三种搜索：

- 标题搜索
- 标签搜索
- 全文搜索

### 第二阶段搜索

加入语义搜索：

- 对 capture 和 wiki_page 做 embedding
- 使用 pgvector 查相似页面
- 在整理台中推荐可补充页面

### 知识图谱

第一版不用图数据库。

先用 page_links 表保存关系，等关系规模和查询复杂度上来后，再考虑 Neo4j 或专门图数据库。

## 浏览器插件架构

### 插件模块

```text
manifest.json
popup UI
content script
background service worker
api client
```

### 插件权限

第一版尽量少要权限：

- activeTab
- contextMenus
- storage
- scripting

### 插件能力

- 保存当前页面
- 保存选中文本
- 添加用户备注
- 发送到 Web API
- 打开整理台

### 插件鉴权

建议：

- Web 登录后生成 extension token
- 插件保存 token 到 chrome.storage
- API 使用 Bearer token

第一版也可以先用 Web 登录态跳转授权，后续再做完整 token 管理。

## Markdown 与导出

数据库是主存储，Markdown 是内容格式。

这样可以同时满足：

- Web 查询和权限控制
- 页面版本管理
- 后续导出
- 后续客户端同步
- 用户数据可迁移

导出格式建议：

```text
knowledge-base/
  个人 Wiki/
    知识管理/
      知识管理的核心是重构认知结构.md
  知脉产品设计/
    产品方案/
      整理台三栏布局.md
```

每个 Markdown 文件带 frontmatter：

```yaml
---
title: 知识管理的核心是重构认知结构
type: 观点
library: 个人 Wiki
folder: 知识管理
tags:
  - 知识管理
  - 个人 Wiki
sources:
  - capture_id
updated_at: 2026-07-05
---
```

## 桌面客户端演进

客户端不建议第一阶段单独开发。

等 Web 和插件闭环稳定后，再做：

- Tauri 或 Electron 封装 Web
- 本地 Markdown 同步目录
- 系统快捷键收集
- 离线草稿
- 本地索引

客户端仍然复用同一套 API 和页面逻辑。

## 安全与隐私

第一版必须考虑：

- 用户数据按 workspace 隔离
- API 必须校验 workspace_id 权限
- 插件 token 可撤销
- AI 请求日志不保存敏感密钥
- 原始网页内容和用户备注需要可删除
- 支持导出和删除账户数据

后续可以增加：

- 本地优先模式
- 自带模型 API Key
- 企业私有化部署

## 推荐 API

### Auth

```text
GET  /api/me
POST /api/auth/extension-token
POST /api/auth/revoke-extension-token
```

### Capture

```text
POST /api/captures
GET  /api/captures
GET  /api/captures/:id
PATCH /api/captures/:id
POST /api/captures/:id/process
```

### Wiki

```text
GET  /api/libraries
POST /api/libraries
GET  /api/libraries/:id/tree
POST /api/folders
PATCH /api/folders/:id
GET  /api/wiki-pages/:id
POST /api/wiki-pages
PATCH /api/wiki-pages/:id
POST /api/wiki-pages/:id/confirm-from-capture
GET  /api/wiki-pages/:id/versions
```

### Search

```text
GET  /api/search?q=
POST /api/search/semantic
```

### Export

```text
POST /api/export/markdown
GET  /api/export/:job_id
```

## 开发里程碑

### M1：Web 基础闭环

- 登录
- 知识库目录树
- Wiki 页面 CRUD
- 收集箱 CRUD
- 整理台静态流程

### M2：AI 整理闭环

- AI 生成整理结果
- 用户确认写入 Wiki
- 来源材料记录
- 页面版本记录

### M3：浏览器插件

- 插件登录
- 保存网页
- 保存选中文本
- 发送到收集箱
- 打开整理台

### M4：搜索与关联

- 标题搜索
- 全文搜索
- 相似页面推荐
- page_links 关系管理

### M5：导出与客户端准备

- Markdown 导出
- 本地目录结构设计
- 客户端封装调研

## 第一版不建议做

- 团队协作
- 复杂权限
- 图数据库
- 完整离线同步
- 移动端 App
- 多模型路由平台
- 网页全文自动抓取

这些功能不是不重要，而是会拖慢核心闭环验证。

