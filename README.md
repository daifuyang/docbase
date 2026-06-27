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

## 命令行工具（CLI）

`docbase` CLI 让 AI 代理和脚本可以直接访问知识库，避免启动 Web 服务器。CLI 通过
`@better-auth/api-key` 插件生成的长期 API Key 鉴权，调用与服务层相同的代码路径。

```bash
# 登录并生成 API Key（默认存储到 ~/.config/docbase/credentials.json，权限 0600）
pnpm exec docbase auth login --username admin --password admin123

# 查看当前用户
pnpm exec docbase auth whoami

# 浏览知识结构
pnpm exec docbase space list
pnpm exec docbase tag list --limit 20

# 从 Markdown 文件创建文档（支持 YAML frontmatter）
cat > /tmp/post.md <<'EOF'
---
title: 复盘：6 月发布
tags: [复盘, release]
status: draft
space: 工程知识库
---
# 背景
本月我们完成了 …[content]
EOF
pnpm exec docbase doc create --from /tmp/post.md

# 查询、发布、删除
pnpm exec docbase doc search "复盘" --json
pnpm exec docbase doc publish <slug>
pnpm exec docbase doc delete <slug> --yes

# 登出：撤销服务端 API Key 并清除本地凭据
pnpm exec docbase auth logout
```

所有命令支持 `--json` 以输出机器可读结果。文档创建、读取、修改复用 `src/server/services/`
下的服务函数（与 Web 端共用同一份验证、限流与权限检查）。

## 文档

- [项目宪章](./.specify/memory/constitution.md)
- [Feature 规范](./specs/001-docbase-mvp/spec.md)
- [实现计划](./specs/001-docbase-mvp/plan.md)
- [数据模型](./specs/001-docbase-mvp/data-model.md)
- [Server Function 契约](./specs/001-docbase-mvp/contracts/server-functions.md)
- [任务列表](./specs/001-docbase-mvp/tasks.md)
