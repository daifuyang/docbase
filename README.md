# DocBase

> 企业知识库 MVP — 面向团队的内部文档平台，支持登录访问、空间/分类组织、文档编辑、标签筛选和基础搜索。

## 技术栈

- **Framework**: TanStack Start + React 19 + TypeScript
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Cache / Queue**: Redis 7
- **Auth**: better-auth
- **Editor**: TipTap + sanitize-html
- **UI**: shadcn/ui + Radix UI + Tailwind CSS v4
- **Tests**: Vitest + Playwright
- **Deploy**: Docker Compose + Caddy 2

## 快速开始

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev
```

访问 `http://localhost:3000`。

种子用户：

- `admin` / `admin123`
- `alice@example.com` / `Password123!`
- `bob@example.com` / `Password123!`

## 当前 MVP

- 内部登录后访问知识内容
- 管理员/成员角色
- 空间、分类、文档、标签
- 文档草稿与发布
- 全局基础搜索
- 中文企业产品风格布局

## 文档

- [项目宪章](./.specify/memory/constitution.md)
- [Feature 规范](./specs/001-docbase-mvp/spec.md)
- [实现计划](./specs/001-docbase-mvp/plan.md)
- [数据模型](./specs/001-docbase-mvp/data-model.md)
- [Server Function 契约](./specs/001-docbase-mvp/contracts/server-functions.md)
- [任务列表](./specs/001-docbase-mvp/tasks.md)
