# DocBase CLI 使用文档

> 命令行访问 DocBase 企业知识库。AI 代理和脚本可以直接创建、读取、发布文档，无须启动 Web 服务。

## 安装

CLI 通过仓库的 `package.json` `bin` 字段暴露。安装后即可在任何目录运行 `docbase` 命令。

```bash
# 在 DocBase 仓库根目录
pnpm install

# 验证安装
pnpm exec docbase --version
# → 0.1.0

# 查看全局帮助
pnpm exec docbase --help
```

> 想让 `docbase` 在任意目录都能直接调用（不必 `pnpm exec` 前缀），可以把 `node_modules/.bin/docbase` 加到 `$PATH`，或在系统级安装。

## 认证（Auth）

CLI 通过 [better-auth](https://www.better-auth.com) 的 [`@better-auth/api-key`](https://www.better-auth.com/docs/plugins/api-key) 插件签发长期 API Key。Key 在服务端哈希存储，本地仅保留明文副本，凭据文件 `chmod 600`。

### 登录

```bash
# 交互输入密码
pnpm exec docbase auth login --username admin

# 直接传密码（注意 shell 历史）
pnpm exec docbase auth login --username admin --password admin123

# 为这个 key 起一个名字（方便日后在管理后台区分）
pnpm exec docbase auth login --username admin --password admin123 --name "alice-laptop"
```

成功后会打印：

```
Logged in as admin. API key stored at /home/orangepi/.config/docbase/credentials.json
```

### 凭据文件位置

- **默认**：`~/.config/docbase/credentials.json`（遵循 XDG Base Directory 规范）
- **覆盖**：环境变量 `DOCBASE_CREDENTIALS_PATH`

格式：

```json
{
  "apiKey": "docbase_xxxxxxxx...",
  "apiKeyId": "apikey_xxx",
  "prefix": "docbase_",
  "user": {
    "id": "user_xxx",
    "username": "admin",
    "displayName": "管理员",
    "role": "admin"
  },
  "createdAt": "2026-06-27T10:00:00Z"
}
```

### 验证登录

```bash
pnpm exec docbase auth whoami
# 输出 id / username / displayName / bio / role / createdAt
```

### 登出（撤销服务端 Key）

```bash
pnpm exec docbase auth logout
# 撤销服务端 API Key + 删除本地凭据文件
```

## 知识结构浏览

```bash
pnpm exec docbase space list           # 列出所有知识空间
pnpm exec docbase tag list            # 列出所有标签
pnpm exec docbase tag list --limit 50 # 限制返回数量
```

## 文档操作

### 创建文档

CLI 接受 Markdown + YAML frontmatter 文件或 stdin。Frontmatter 字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 文档标题（slug 自动生成） |
| `tags` | | 标签数组 |
| `status` | | `draft` 或 `published`（默认 draft） |
| `space` | | 知识空间 slug 或名称 |
| `category` | | 分类 slug 或名称 |

文件示例 (`post.md`)：

```markdown
---
title: 6 月发布复盘
tags: [复盘, release]
status: draft
space: 工程知识库
---

# 背景

本月我们完成了 **API Key 插件**集成。

## 时间线

- 第 1 周：方案设计
- 第 2 周：迁移文件
- 第 3 周：联调上线

```ts
// code blocks 也是支持的
const result = await auth.api.createApiKey({ ... })
```

详见 [DocBase](https://example.com)。
```

```bash
# 从文件创建
pnpm exec docbase doc create --from /path/to/post.md

# 从 stdin 创建
cat post.md | pnpm exec docbase doc create --stdin

# CLI 标志优先级高于 frontmatter
pnpm exec docbase doc create --from post.md --status published --tags cli,urgent

# 显式指定 space（覆盖 frontmatter）
pnpm exec docbase doc create --from post.md --space "工程知识库"
```

成功时输出：

```
Created: 6-yue-fa-bu-fu-pan (id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
{ document: { ... } }
```

支持的 Markdown 子集（GitHub Flavored Markdown）：标题、粗体/斜体/行内代码、链接、图片、有序/无序列表、围栏代码块、引用。表格、脚注、嵌入等高级特性不在 v1 范围内。

### 查询文档

```bash
# 按关键词搜索（同时匹配标题、摘要、正文）
pnpm exec docbase doc search "复盘"

# 列出已发布文档
pnpm exec docbase doc list --status published

# 列出草稿
pnpm exec docbase doc list --status draft

# 按空间 / 分类 / 标签过滤
pnpm exec docbase doc list --space engineering --category standards --tag cli

# 分页
pnpm exec docbase doc list --page 2 --page-size 10

# 查看单篇文档详情（含 contentHtml）
pnpm exec docbase doc get 6-yue-fa-bu-fu-pan
```

### 更新文档

```bash
# 用新文件覆盖内容和标题
pnpm exec docbase doc update 6-yue-fa-bu-fu-pan --from post-v2.md

# 单独修改元数据
pnpm exec docbase doc update 6-yue-fa-bu-fu-pan \
  --title "6 月发布复盘 (终版)" \
  --tags "复盘,release,final"
```

### 发布草稿

```bash
pnpm exec docbase doc publish 6-yue-fa-bu-fu-pan
```

### 删除文档

```bash
# 交互确认（TTY 下会询问 [y/N]）
pnpm exec docbase doc delete 6-yue-fa-bu-fu-pan

# 跳过确认
pnpm exec docbase doc delete 6-yue-fa-bu-fu-pan --yes
```

## 输出格式

所有命令支持两个全局标志：

- `--json` — 以 JSON 格式输出，便于脚本消费
- `--no-color` — 关闭 ANSI 颜色
- `-v, --verbose` — 详细日志

```bash
# 人类阅读（默认）
pnpm exec docbase doc list

# 机器可读
pnpm exec docbase doc list --json | jq '.items[] | {slug, title, status}'
```

## 退出码

| 退出码 | 含义 |
|---|---|
| `0` | 成功 |
| `1` | 内部错误 |
| `2` | 参数校验失败 |
| `3` | 未知错误 |
| `4` | 401 未认证（API Key 无效或未登录） |
| `5` | 403 权限不足 |
| `6` | 429 限流（创建文档 10/60s/用户） |

```bash
# 脚本中检查错误
if ! pnpm exec docbase doc create --from post.md; then
  case $? in
    4) pnpm exec docbase auth login --username ... ;;
    6) sleep 60; retry ;;
  esac
fi
```

## 故障排查

| 现象 | 可能原因 | 解决 |
|---|---|---|
| `UNAUTHENTICATED` | 未登录或 Key 已撤销 | `docbase auth login` 重新登录 |
| `API key 无效` | `credentials.json` 中的 key 在服务端被删除 | 重新 `auth login` 覆盖本地文件 |
| `Failed query: insert into "document" ... duplicate key` | slug 冲突 | 检查同一空间下是否已有同名文档；CLI 会自动追加 `-2`、`-3` 等后缀 |
| `Rate limit exceeded` | 超过 10 docs/60s | 等待重试；CLI 不再做自动重试 |
| `Failed to validate API key: Rate limit exceeded` | API key 插件的 per-key 限流 | 文档创建类操作的服务层限流是 10/60s；API key 插件本身的限流已在配置中关闭 |

## 开发与扩展

CLI 通过 `src/server/services/*` 调用业务逻辑——和 Web 端共用同一份验证、限流、权限检查与 TipTap 转换。新增 CLI 子命令时：

1. 在 `src/server/services/<domain>.ts` 添加服务函数
2. 在 `src/cli/api-client.ts` 暴露对应方法
3. 在 `src/cli/commands/<domain>.ts` 注册 commander 子命令
4. 在 `tests/integration/cli/<domain>.test.ts` 添加集成测试

入口与 shebang：`src/cli/index.ts` 以 `#!/usr/bin/env -S pnpm exec tsx` 开头，通过 `package.json` `bin` 字段暴露为 `docbase` 命令。