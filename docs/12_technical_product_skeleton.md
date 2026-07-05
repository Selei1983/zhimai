# 技术产品骨架

## 总体架构

第一版采用 Web 优先架构：

```text
Browser Extension
        |
        v
Web API -> AI Processing -> Knowledge Store
        |
        v
Web App
```

Web App 是主界面，浏览器插件是采集入口，后续桌面客户端复用同一套 Web App 和 API。

## 模块拆分

### 1. Web App

负责用户可见的核心体验：

- 登录
- 工作台
- 收集箱
- 整理台
- Wiki 页面列表
- Wiki 页面详情
- Markdown 编辑

### 2. Browser Extension

负责网页采集：

- 读取当前页面标题和 URL
- 读取用户选中文本
- 接收用户备注
- 调用 Web API 创建 Capture
- 打开 Web 整理台

### 3. API Server

负责业务能力：

- 创建收集内容
- 查询收集箱
- 调用 AI 整理
- 保存整理结果
- 创建或更新 Wiki 页面
- 查询知识库
- 管理标签和关联

### 4. AI Processing

负责知识重构：

- 内容摘要
- 类型判断
- 主题识别
- Wiki 草稿生成
- 关联页面推荐
- 质量提示

### 5. Knowledge Store

第一版可以先用数据库保存结构化数据，同时支持导出 Markdown。

后续客户端阶段再增强本地 Markdown 同步。

## 建议数据表

### users

- id
- email
- name
- created_at

### captures

- id
- user_id
- source_type
- source_title
- source_url
- selected_text
- note
- status
- created_at
- updated_at

### processing_results

- id
- capture_id
- summary
- content_type
- topics_json
- suggested_action
- suggested_title
- key_points_json
- wiki_draft
- related_pages_json
- quality_notes_json
- created_at

### wiki_pages

- id
- user_id
- title
- slug
- type
- content_markdown
- summary
- tags_json
- created_at
- updated_at

### page_links

- id
- user_id
- from_page_id
- to_page_id
- relation_type
- reason
- confidence
- created_at

### page_sources

- id
- page_id
- capture_id
- note
- created_at

## API 草案

### Capture

```text
POST /api/captures
GET /api/captures
GET /api/captures/:id
PATCH /api/captures/:id
```

### Processing

```text
POST /api/captures/:id/process
GET /api/captures/:id/processing-result
```

### Wiki

```text
POST /api/wiki-pages
GET /api/wiki-pages
GET /api/wiki-pages/:id
PATCH /api/wiki-pages/:id
POST /api/wiki-pages/:id/sources
POST /api/wiki-pages/:id/links
```

### Extension

插件第一版只需要调用：

```text
POST /api/captures
GET /api/me
```

## 第一版页面清单

### Web

- 登录页
- 工作台
- 收集箱
- 整理台
- 知识库
- Wiki 页面详情

### Extension

- 插件弹窗
- 登录授权状态
- 保存成功状态
- 右键菜单

## 推荐实现顺序

### 里程碑 1：Web 骨架

- 搭建 Web 项目
- 完成页面路由
- 完成基础布局
- 完成收集箱静态数据
- 完成整理台静态预览

### 里程碑 2：数据闭环

- 创建 Capture
- 查询 Capture
- 保存 Wiki 页面
- 查看 Wiki 页面
- 来源材料关联

### 里程碑 3：AI 闭环

- 接入 AI 整理接口
- 生成 ProcessingResult
- 预览 Wiki 草稿
- 用户确认写入

### 里程碑 4：插件 MVP

- 创建浏览器插件
- 保存当前页面
- 保存选中文本
- 添加备注
- 发送到 Web 收集箱

### 里程碑 5：打磨体验

- 整理台交互优化
- 页面关联推荐
- 标签筛选
- 搜索
- Markdown 导出

## 关键产品决策

### Web 先行

先把知识重构闭环跑通。

浏览器插件只解决输入成本，不承担复杂整理。

### 用户确认优先

第一版不默认自动写入 Wiki，必须经过用户确认。

这是为了保护知识库质量。

### Markdown 兼容

即使第一版使用数据库，也要保证 Wiki 页面可以导出为 Markdown。

这会增强用户信任。

### 客户端后置

客户端不要过早做。

等 Web 和插件闭环稳定后，再用客户端增强本地、离线和系统级体验。

