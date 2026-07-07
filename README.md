# 知脉

知脉是一个个人知识整理与重构系统。

它帮助用户把日常看到的零碎内容，例如文章、链接、截图、书摘、想法、对话片段，持续整理成结构化、可关联、可复用的个人 Wiki。

## 产品一句话

知脉，让知识长出脉络。

## 核心目标

知脉不是一个普通笔记工具，也不是一个简单收藏夹。

它的核心目标是：

- 降低知识整理成本
- 把碎片信息转化为 Wiki 页面
- 建立知识之间的关联
- 帮助用户长期形成自己的知识系统

## 当前文档

- [01 产品定位](docs/01_product_positioning.md)
- [02 MVP 范围](docs/02_mvp_scope.md)
- [03 页面与信息架构](docs/03_information_architecture.md)
- [04 AI 知识重构流程](docs/04_ai_workflow.md)
- [05 Wiki 页面模板](docs/05_wiki_page_template.md)
- [06 待讨论问题](docs/06_open_questions.md)
- [07 第一版用户流程](docs/07_user_flow.md)
- [08 AI 整理提示词草案](docs/08_ai_prompt_draft.md)
- [09 Markdown 存储结构](docs/09_markdown_storage_design.md)
- [10 MVP 推进路线](docs/10_mvp_roadmap.md)
- [11 Web 与浏览器插件产品方案](docs/11_web_extension_product_design.md)
- [12 技术产品骨架](docs/12_technical_product_skeleton.md)
- [13 技术架构设计](docs/13_technical_architecture.md)
- [14 工程实施方案](docs/14_engineering_implementation_plan.md)
- [15 服务器部署](docs/15_server_deployment.md)

## 产品 Demo

- [知脉 Web Demo](demo/index.html)

## 项目技能

- [知脉服务器部署 Skill](skills/zhimai-server-deploy/SKILL.md)

## 开发启动

Web 应用位于 `apps/web`。

本地数据库使用 Docker：

```bash
docker compose up -d
```

Web 开发：

```bash
cd apps/web
cp .env.example .env
npm run db:validate
npm run dev
```
