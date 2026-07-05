# 工程实施方案

## 第一版工程形态

建议第一版使用单仓库：

```text
zhimai/
  apps/
    web/
    extension/
  packages/
    database/
    shared/
    ai/
  docs/
```

这样 Web、插件、共享类型、AI 提示词和数据库模型可以一起演进。

如果想更快，也可以先只有：

```text
app/
prisma/
extension/
lib/
```

等复杂度上来再拆 packages。

## 推荐目录

```text
apps/web/
  app/
    workspace/
    inbox/
    wiki/
    processing/
    api/
  components/
    layout/
    capture/
    wiki/
    processing/
  lib/
    auth.ts
    db.ts
    permissions.ts

apps/extension/
  manifest.json
  popup/
  background/
  content/

packages/database/
  prisma/
    schema.prisma
    migrations/

packages/ai/
  prompts/
  schemas/
  processors/

packages/shared/
  types/
  constants/
  validators/
```

## 第一版页面实现顺序

### 1. Web 框架

先搭：

- 左侧目录
- 顶部操作区
- 主内容区
- 路由
- 登录占位

先不用接 AI。

### 2. 知识库

先做知识库，因为它是所有内容最终落点。

实现：

- library
- folder
- wiki_page
- 左侧目录树
- 右侧页面阅读
- Markdown 编辑

### 3. 收集箱

实现：

- capture 创建
- capture 列表
- capture 详情
- 状态流转

### 4. 整理台

实现：

- 左侧原文
- 中间 AI 判断
- 右侧 Wiki 草稿
- 确认写入

### 5. AI 接入

实现：

- prompt
- JSON schema
- processing_result
- 失败重试
- 结果预览

### 6. 浏览器插件

等 `POST /api/captures` 稳定后再做插件。

实现：

- 保存当前网页
- 保存选中文本
- 添加备注
- 发送到收集箱
- 打开整理台

## 数据库优先级

第一批表：

- users
- workspaces
- libraries
- folders
- wiki_pages
- captures
- processing_results

第二批表：

- page_sources
- page_versions
- page_links

第三批表：

- embeddings
- export_jobs
- extension_tokens

## 关键工程原则

### 1. 先让数据结构稳定

知脉的复杂度主要在知识结构，不在 UI。

先把 library、folder、page、capture 的关系设计稳。

### 2. AI 输出必须可校验

不要让 AI 直接返回任意 Markdown。

需要：

- JSON schema
- 字段校验
- fallback 逻辑
- 用户确认

### 3. 页面内容使用 Markdown

数据库存 Markdown，前端渲染 Markdown。

这样后续导出和客户端同步会简单很多。

### 4. 插件只做入口

插件不做复杂整理。

插件只创建 capture，然后跳转 Web。

### 5. 搜索先简单后语义

第一版：

- 标题搜索
- 全文搜索

第二版：

- embedding
- 相似页面推荐
- 语义搜索

## 第一阶段验收标准

第一阶段完成后，用户应该能：

1. 创建知识库和目录
2. 创建和阅读 Wiki 页面
3. 输入一段碎片内容
4. 让 AI 生成整理结果
5. 确认写入 Wiki
6. 在左侧目录看到新页面
7. 从浏览器插件保存网页片段到收集箱

## 推荐下一步

下一步可以开始创建真实工程项目。

建议先做：

- Next.js 项目
- Prisma schema
- 左侧目录树
- Wiki 页面 CRUD
- 收集箱 CRUD

AI 和插件可以等基础数据闭环跑通后再接。

