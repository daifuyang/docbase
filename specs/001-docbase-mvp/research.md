# Research: DocBase 企业知识库 MVP

## Decisions

### Framework

**Decision**: TanStack Start.

**Rationale**: 保留现有全栈 SSR、file route、server function 和 React 生态，适合内部管理型应用。

### Data

**Decision**: PostgreSQL + Drizzle ORM.

**Rationale**: 空间、分类、文档、标签关系清晰，Drizzle 类型安全且迁移可审查。

### Auth

**Decision**: better-auth email/password，内部登录访问。

**Rationale**: MVP 单工作区，不做 SSO；管理员创建成员满足内部准入。

### Editor

**Decision**: TipTap JSON 持久化，服务端渲染并清洗 HTML。

**Rationale**: 富文本编辑能力成熟，JSON 适合后续版本、导出和结构化处理。

### Search

**Decision**: 基础搜索先匹配标题和摘要，并支持空间、分类、标签筛选。

**Rationale**: 先保证搜索入口真实可用；后续可升级 PostgreSQL full-text search 或外部搜索服务。

### Rate Limits

| Action | Scope | Limit |
|--------|-------|-------|
| login | IP | 10/min |
| create document | user | 10/min |

## Out of Scope

- 多租户工作区
- 空间级权限
- 公开分享链接
- 附件上传
- 实时协作
