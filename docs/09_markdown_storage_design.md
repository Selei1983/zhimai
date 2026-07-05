# Markdown 存储结构

## 设计原则

第一版建议采用 Markdown 文件作为知识库底层。

原因：

- 简单透明
- 易于备份
- 易于迁移
- 方便和 Obsidian、Logseq 等工具兼容
- 适合先验证产品价值

## 建议目录

```text
knowledge-base/
  inbox/
  wiki/
  sources/
  system/
    tags.md
    index.md
    links.json
```

## inbox

保存未处理或待确认的碎片。

文件命名：

```text
YYYY-MM-DD-HHMM-短标题.md
```

示例：

```text
2026-07-05-1720-知识管理不是收藏.md
```

## wiki

保存正式 Wiki 页面。

建议按主题文件夹组织：

```text
wiki/
  知识管理/
    个人知识管理.md
    个人 Wiki.md
  产品设计/
    MVP.md
```

第一版也可以先全部平铺，等页面数量超过 100 再分目录。

## sources

保存原始来源材料。

每个来源可以独立成文件，Wiki 页面通过 frontmatter 引用来源 id。

## Wiki 页面 frontmatter

```yaml
---
title: 知识管理的核心是重构认知结构
type: 观点
tags:
  - 知识管理
  - 个人 Wiki
created_at: 2026-07-05
updated_at: 2026-07-05
sources:
  - 2026-07-05-1720-知识管理不是收藏
related:
  - 个人知识管理
  - 个人 Wiki
---
```

## Link 数据

页面之间的关系可以用独立 JSON 保存：

```json
[
  {
    "from": "知识管理的核心是重构认知结构",
    "to": "个人知识管理",
    "relation_type": "补充",
    "reason": "该页面解释了个人知识管理的核心目标",
    "confidence": 0.86
  }
]
```

## 第一版建议

最开始先采用：

- Markdown 页面
- YAML frontmatter
- 双链文本
- 独立 links.json

等产品验证后，再考虑数据库、向量索引和图数据库。

