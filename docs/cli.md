# DocBase CLI 使用指南

> 命令行管理知识库：空间、分类、标签、文档。CLI 与 Web 共用账号体系（同一份 user 表、同一份业务数据），但鉴权机制独立。

## 两种运行模式

| 模式 | 触发 | 依赖 | 适合 |
|---|---|---|---|
| **In-process（默认）** | 不传 `--server` | 需要源码 + `node_modules` + `.env` + DB/Redis 网络可达 | 单机开发、团队成员各自的 dev 机 |
| **HTTP** | `--server <url>` 或 `DOCBASE_SERVER=<url>` 环境变量 | 只需要网络可达 server + 有效的 API Key | CI、远程脚本、跨机器、不想要源码的用户 |

切换模式不需要重新登录——CLI 复用同一份本地 credentials 文件。

### HTTP 模式示例

```bash
# 在 dev 机器登录一次（in-process）
pnpm cli auth login --username admin --password admin123

# 然后任何机器：只需装 CLI + server URL + 拿 credentials 文件
pnpm cli --server https://kb.example.com space list
pnpm cli --server https://kb.example.com doc create -f post.md --space "工程知识库"

# 或者用环境变量
export DOCBASE_SERVER=https://kb.example.com
pnpm cli space list
```

HTTP 模式下，CLI 是"纯前端"工具：
- 不需要源码 / node_modules / 源码树
- 不需要 `DATABASE_URL` / `REDIS_URL` / `BETTER_AUTH_SECRET`（secret 只在 server）
- 只需要 server URL + 本地存好的 API Key

## HTTP API + OpenAPI

server 暴露 OpenAPI 3 规范供自动化：

| 端点 | 说明 |
|---|---|
| `GET /api/v1/openapi/json` | 完整 OpenAPI 3.0 spec（components + paths + security） |
| `GET /api/v1/cli/auth/login` | 登录（拿 session token / API Key） |
| `GET /api/v1/cli/auth/whoami` | 当前用户 |
| `GET /api/v1/cli/spaces` | 列出空间 |
| `POST /api/v1/cli/spaces` | 创建空间（admin） |
| `GET /api/v1/cli/spaces/{spaceId}/categories` | 列出分类 |
| `POST /api/v1/cli/spaces/{spaceId}/categories` | 创建分类（admin） |
| `GET /api/v1/cli/tags` | 列出标签 |
| `POST /api/v1/cli/tags` | 创建标签（admin） |
| `GET /api/v1/cli/documents` | 列出/搜索文档 |
| `POST /api/v1/cli/documents` | 创建文档（接受 `contentMarkdown` 字段，server 转 TipTap JSON） |
| `GET /api/v1/cli/documents/{slug}` | 文档详情 |
| `PUT /api/v1/cli/documents/{slug}` | 更新文档 |
| `DELETE /api/v1/cli/documents/{slug}` | 删除文档 |

所有 endpoint 都要求 `Authorization: Bearer <apiKey>`（除了 `/auth/login`）。

### 错误响应统一格式

```json
{
  "code": "UNAUTHENTICATED",
  "message": "请先登录",
  "statusCode": 401
}
```

`code` 是稳定的字符串（适合客户端分支），`message` 是人话，`statusCode` 是 HTTP 状态码。

## 快速上手

```bash
# 1. 登录（一次性，生成 API Key 存到 ~/.config/docbase/credentials.json）
pnpm cli auth login --username admin --password admin123

# 2. 跑命令（不需要重新登录）
pnpm cli space list
pnpm cli doc list

# 3. 退出（撤销 API Key + 删本地凭据）
pnpm cli auth logout
```

完整子命令用 `pnpm cli <command> --help` 看。

## 鉴权机制

CLI 用 **better-auth 的 API Key 鉴权**（与 Web 的 session cookie 完全分开）：

| 维度 | CLI | Web |
|---|---|---|
| 凭证 | API Key（明文存本地，0o600） | session cookie（HttpOnly） |
| 传输 | `x-api-key` HTTP header | `docbase.session_token` cookie |
| 存储 | `~/.config/docbase/credentials.json` | 浏览器 cookie jar |
| 验证 | `auth.api.verifyApiKey` | `auth.api.getSession` |
| 撤销 | `pnpm cli auth logout` | Web "退出" 按钮 |

### 为什么 CLI 不复用 Web 的 session cookie？

CLI 是无状态进程（每次 `pnpm cli xxx` 都是新进程），不适合用浏览器 cookie。better-auth 官方推荐 CLI / 脚本 / 外部集成场景用 API Key 插件。

### API Key rate limit（官方推荐配置）

CLI 走的 `verifyApiKey` 端点按 API Key 计 rate limit，配置在 `src/lib/auth.server.ts`：

```ts
rateLimit: {
  enabled: true,
  timeWindow: 60 * 60 * 1000,  // 1 hour
  maxRequests: 1000,           // 1000 req/hour
}
```

这是 better-auth 官方文档示例的"secret"配置（默认 `24h/10` 太严，批量 CLI 脚本必然撞锁）。1h/1000 留足余量同时挡 brute force。

> 之前默认 `24h/10` 的版本里，跑批量脚本（建 5 个 space + 14 个 category）会触发 24h 锁，所有 CLI 命令 UNAUTH。当前配置已修。

### Credentials 文件

- 路径：`$XDG_CONFIG_HOME/docbase/credentials.json`（默认 `~/.config/docbase/credentials.json`），可用 `DOCBASE_CREDENTIALS_PATH` 覆盖
- 权限：`0o600`（POSIX；Windows 静默忽略）
- 内容：
  ```json
  {
    "apiKey": "docbase_xxx...",
    "apiKeyId": "U40Vv...",
    "prefix": "docbase_",
    "expiresAt": null,
    "user": { "id": "...", "username": "admin", "displayName": "管理员", "role": "admin" },
    "createdAt": "2026-06-27T..."
  }
  ```

### Key 过期提示

CLI 在每次调用前检查 `expiresAt`：

- **未过期**：正常调用
- **7 天内过期**：`stderr` 输出 `warn: API key 将在 N 天后过期（...），请提前 \`docbase auth login\` 续期`
- **已过期**：抛清晰错误 `API key 已于 ... 过期，请重新运行 \`docbase auth login\``

当前默认创建的 key 是 indefinite（`expiresAt: null`），但如果未来引入"带过期时间的 key"（如 webhook 集成），提示机制直接生效。

## 子命令清单

### auth

| 命令 | 用途 |
|---|---|
| `auth login --username <u> --password <p>` | 登录（生成 API Key 存本地） |
| `auth login --username <u>` | 登录（密码交互输入，避免 ps 历史泄露） |
| `auth logout` | 撤销 API Key + 删本地凭据 |
| `auth whoami` | 显示当前登录的用户 |

### space

| 命令 | 用途 |
|---|---|
| `space list` (`ls`) | 列出所有空间 |
| `space create --name <n> --description <d>` | 创建空间（需 admin） |
| `space create-category --space <s> --name <n> --description <d>` | 在空间下创建分类（需 admin） |

### tag

| 命令 | 用途 |
|---|---|
| `tag list` (`ls`) | 列出所有标签 |
| `tag create --name <n>` | 创建标签（需 admin；同名幂等返回已有） |

### doc

| 命令 | 用途 |
|---|---|
| `doc create -f <file> --space <s> --category <c> --status published --tags t1,t2` | 从 Markdown 文件创建 |
| `doc list` (`ls`) | 列出/搜索文档 |
| `doc search <query>` | 全文搜索 |
| `doc get <slug>` | 查看文档详情（含 contentHtml） |
| `doc update <slug> -f <file>` | 从 Markdown 更新 |
| `doc publish <slug>` | 发布（draft → published） |
| `doc delete <slug>` | 删除 |

`doc create` 支持 frontmatter（见 `pnpm cli doc create --help`）：

```markdown
---
title: <一句话标题>
space: 工程知识库            # slug 或 name
category: 研发规范            # slug 或 name（可选）
status: published            # draft | published
tags: [k8s, infra]
---

# 正文 markdown
```

## 故障排查

| 症状 | 原因 / 处理 |
|---|---|
| `error [UNAUTHENTICATED]: 请先运行 \`docbase auth login\`` | 还没登录 / credentials 文件丢失。`pnpm cli auth login` 一次 |
| `error [UNAUTHENTICATED]: API key 已于 ... 过期` | Key 已过期。`pnpm cli auth login` 续期 |
| `error [UNAUTHENTICATED]: 未登录` 且刚 login 过 | credentials 文件被改 / 0o600 权限丢失。`rm ~/.config/docbase/credentials.json && pnpm cli auth login` |
| `error [RATE_LIMITED]: 操作过于频繁` | 1h 内调用超过 1000 次，或 signInService 错密码触发。等 1h 或检查脚本 |
| `error [FORBIDDEN]: 仅管理员可执行该操作` | 当前账号不是 admin。用 admin 账号 `pnpm cli auth login` 重新登 |

## 跟 Web 共享什么

| 共享 | 不共享 |
|---|---|
| user / account / session / verification 表 | session cookie（Web 专用） |
| space / category / tag / document 表 | apikey 表（CLI 用，但 Web 不走） |
| service 函数（`getCurrentUserService` 等） | 登录入口：`signInService` CLI 直接调、Web 走 TanStack Start server fn |
| 角色 / 权限校验（`requireAdmin`） | UI（CLI 无 UI） |

## 安全性

| 项 | 说明 |
|---|---|
| credentials 文件权限 | `0o600`（仅 owner 可读写） |
| API Key 生命周期 | 用户主动 `auth logout` 撤销；7 天内过期前有 warn；server 端独立追踪 `lastRequest` |
| 离机器即丢 | 文件不存则下次需重新 `auth login` |
| 跟 Web session 隔离 | 撤销 API Key 不影响 Web session；反之亦然 |
| BETTER_AUTH_SECRET | CLI 不需要这个 secret（不像 Web 那样用 cookie signing） |

## 实现参考

- `src/cli/index.ts` — 入口（`#!/usr/bin/env -S pnpm exec tsx`）
- `src/cli/commands/*.ts` — 子命令实现
- `src/cli/api-client.ts` — 客户端，包装 service 层
- `src/cli/credentials.ts` — credentials 文件读写
- `src/lib/auth.server.ts` — better-auth 配置（含 apiKey rate limit）
- `src/server/services/auth.ts` — `signInService` / `createApiKeyService` 等
