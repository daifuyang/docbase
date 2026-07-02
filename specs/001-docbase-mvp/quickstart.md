# Quickstart: DocBase 企业知识库 MVP

## Local Setup

```bash
cp .env.example .env
# ensure PostgreSQL 16 and Redis 7 are already running locally
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

访问 `http://localhost:3000`。

## Seed Users

- `admin` / `admin123`
- `alice@example.com` / `Password123!`
- `bob@example.com` / `Password123!`

## Smoke Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | 未登录访问 `/` | 跳转登录页 |
| 2 | 使用管理员登录 | 进入知识首页 |
| 3 | 访问 `/documents/new` | 看到文档编辑器 |
| 4 | 选择空间并发布文档 | 跳转文档详情页 |
| 5 | 点击搜索图标并输入关键词 | 看到真实文档结果 |
| 6 | 访问 `/spaces/product-knowledge-base` | 看到空间文档列表 |

## Main Routes

- `/auth/login`
- `/`
- `/documents/new`
- `/documents/$slug`
- `/documents/$slug/edit`
- `/spaces/$slug`
- `/tags/$slug`
