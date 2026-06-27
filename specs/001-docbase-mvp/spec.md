# Feature Specification: DocBase 企业知识库 MVP

**Feature Branch**: `001-docbase-mvp`
**Created**: 2026-06-26
**Replanned**: 2026-06-27
**Status**: Draft
**Input**: DocBase 是一个面向团队的企业知识库 / 内部文档平台。MVP 聚焦登录后访问、空间与分类组织、文档创建编辑、标签辅助筛选、真实基础搜索、管理员创建成员与维护知识库结构。

## User Scenarios & Testing

### User Story 1 - 成员访问知识库首页 (Priority: P1)

作为团队成员，我希望登录后看到最近更新的文档、常用标签与工作区导航，以便快速回到团队知识内容。

**Independent Test**: 未登录访问 `/` 跳转登录；登录后访问 `/` 看到文档列表和“新建文档”入口。

### User Story 2 - 按空间和分类浏览文档 (Priority: P1)

作为团队成员，我希望通过空间和分类浏览文档，以便按业务或职能查找知识。

**Independent Test**: 访问 `/spaces/<slug>` 只展示该空间内已发布文档；文档详情显示所属空间和分类。

### User Story 3 - 创建和编辑文档 (Priority: P1)

作为团队成员，我希望选择空间、分类、标签并使用富文本编辑器创建文档，以便沉淀团队知识。

**Independent Test**: 登录后访问 `/documents/new`，填写标题、空间、正文后发布，跳转 `/documents/<slug>`，首页和空间页可见。

### User Story 4 - 搜索文档 (Priority: P1)

作为团队成员，我希望通过全局搜索查找文档，以便快速定位标题、摘要、标签、空间或分类相关内容。

**Independent Test**: 点击顶部搜索图标，输入关键词后看到真实文档结果，点击进入文档详情。

### User Story 5 - 管理知识库结构和成员 (Priority: P2)

作为管理员，我希望创建成员、空间和分类，以便维护内部知识库的信息架构。

**Independent Test**: 管理员可调用成员、空间、分类管理接口；普通成员调用这些接口返回权限不足。

## Requirements

- **FR-001**: 系统 MUST 默认要求登录后访问知识内容；未登录访问首页、空间页、标签页、文档详情和搜索 MUST 被拦截。
- **FR-002**: 系统 MUST 支持 `admin` 与 `member` 两种角色。
- **FR-003**: 管理员 MUST 能创建成员；开放注册页不属于 MVP 入口。
- **FR-004**: 管理员 MUST 能创建空间和分类；成员不能创建或修改空间、分类。
- **FR-005**: 每篇文档 MUST 归属一个空间，MAY 归属一个分类，MAY 关联 0-10 个标签。
- **FR-006**: 成员 MUST 能创建、编辑、删除自己创建的文档。
- **FR-007**: 文档 MUST 支持 `draft` 与 `published` 状态；草稿仅创建者可见。
- **FR-008**: 文档正文 MUST 以 TipTap JSON 持久化，并在服务端渲染为经 `sanitize-html` 清洗后的 HTML。
- **FR-009**: 全局搜索 MUST 返回真实文档结果，至少匹配标题和摘要；空间、分类、标签筛选 MUST 可组合。
- **FR-010**: 标签页 `/tags/<slug>` MUST 展示带该标签的已发布文档。
- **FR-011**: sitemap MUST 输出 `/documents/<slug>` 和 `/tags/<slug>`。
- **FR-012**: UI MUST 使用中文企业知识库语义，避免消费型内容产品文案。

## Key Entities

- **User**: better-auth 用户，扩展 `username`、`display_name`、`bio`、`role`。
- **Space**: 知识空间，包含 `name`、`slug`、`description`、`sort_order`、`created_by`。
- **Category**: 空间内分类，包含 `space_id`、`name`、`slug`、`description`、`sort_order`。
- **Document**: 文档，包含 `author_id`、`last_editor_id`、`space_id`、`category_id`、`title`、`slug`、`content_json`、`excerpt`、`status`、`published_at`、`view_count`。
- **Tag**: 辅助筛选标签。
- **DocumentTag**: 文档与标签的多对多关系。

## Success Criteria

- **SC-001**: 未登录用户访问知识内容 100% 被导向登录或返回未认证。
- **SC-002**: 登录成员可在 60 秒内完成“新建文档 -> 发布 -> 查看详情”。
- **SC-003**: 搜索输入关键词后能在 1 秒内返回基础结果。
- **SC-004**: 首页、空间页、文档详情在 100 并发下 p95 响应时间 < 3 秒。
- **SC-005**: 桌面、移动和超大屏布局无文本溢出、控件重叠或主内容失衡。

## Assumptions

- MVP 是单工作区内部系统，不做多租户和空间级权限。
- 全员可读已发布文档；成员只能编辑自己创建的文档。
- 分类由管理员治理；标签由成员在文档编辑时维护。
- 公开阅读与消费型互动不属于 MVP。
