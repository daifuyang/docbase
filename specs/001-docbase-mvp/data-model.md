# Data Model: DocBase 企业知识库 MVP

## ER Overview

```text
user (better-auth + role)
 ├── space.created_by
 ├── document.author_id
 ├── document.last_editor_id
space ── category
space ── document ── document_tag ── tag
category ── document
```

## User

better-auth 管理基础认证字段。DocBase 扩展：

- `username`: 唯一账号名
- `display_name`: 展示名
- `bio`: 简介
- `role`: `admin | member`

## Space

- `id`: uuid
- `name`: 1-60 字
- `slug`: URL 唯一标识
- `description`: 可选说明
- `sort_order`: 排序
- `created_by`: 管理员用户
- `created_at`, `updated_at`

## Category

- `id`: uuid
- `space_id`: 所属空间
- `name`: 1-60 字
- `slug`: 空间内分类标识
- `description`: 可选说明
- `sort_order`: 排序
- `created_at`, `updated_at`

## Document

- `id`: uuid
- `author_id`: 创建者
- `last_editor_id`: 最近编辑者
- `space_id`: 必填空间
- `category_id`: 可选分类
- `title`: 1-200 字
- `slug`: 空间内唯一
- `content_json`: TipTap JSON，最大 200KB
- `excerpt`: 摘要
- `status`: `draft | published`
- `published_at`: 发布时间
- `view_count`: 查看次数
- `created_at`, `updated_at`

状态规则：

- `draft`: 仅创建者可见
- `published`: 登录成员可见

## Tag / DocumentTag

标签是辅助筛选维度。每篇文档最多 10 个标签，标签名归一化为小写。`document_tag` 使用 `(document_id, tag_id)` 复合主键。
