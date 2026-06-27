# CLI 在 AI 代理中的集成模式

> 真实场景：让 Claude / GPT 等 LLM 代理通过 DocBase CLI 直接沉淀知识。

## 模式一：研究结束时的自动沉淀

让 LLM 完成代码评审 / 调研后，把结论写成 Markdown，通过 CLI 落库：

```text
SYSTEM:
你是一名资深工程师。完成任何调研或评审任务后，输出一段 Markdown 总结，
格式如下：

---
title: <一句话标题>
tags: [调研, <相关标签>]
status: draft
space: 工程知识库
---

<正文>

最后，运行：
  pnpm exec docbase doc create --from /tmp/notes.md --json
并把返回的 slug 报告给用户。
```

代理在交付结论的同时把知识沉淀到团队知识库。

## 模式二：和 Git 工作流绑定

提交 PR 时自动把 commit message / diff 总结写入知识库：

```bash
# .husky/post-commit 或 GitHub Action
SUMMARY=$(git log -1 --pretty=%B | head -1)
{
  echo "---"
  echo "title: $(git log -1 --pretty=%s)"
  echo "tags: [git, $(git rev-parse --abbrev-ref HEAD)]"
  echo "status: draft"
  echo "space: 工程知识库"
  echo "---"
  echo ""
  echo "$SUMMARY"
} > /tmp/commit-note.md

pnpm exec docbase doc create --from /tmp/commit-note.md
```

## 模式三：批量导入

迁移现有笔记或 wiki 时：

```bash
for f in /path/to/notes/*.md; do
  pnpm exec docbase doc create --from "$f" --json \
    | jq -r '"imported: " + .document.slug'
done
```

## 模式四：定时同步外部知识源

每周把 RSS / 公众号收藏 / API changelog 同步到知识库：

```bash
# 0 9 * * 1  crontab
curl -s https://example.com/changelog | \
  pandoc -f html -t markdown_strict -o /tmp/clog.md
pnpm exec docbase doc create --from /tmp/clog.md --tags "changelog,weekly"
```

## 安全约束

- **凭据最小化**：为每个 AI 代理创建独立的 API Key，便于在管理后台审计和撤销。`auth login --name "agent-x"`。
- **角色隔离**：只给 AI 代理创建 `member` 角色的 key，避免它误用管理员 API（如 `space create`）。
- **凭据文件权限**：CLI 自动 `chmod 600`；不要把 `credentials.json` 提交到 git。
- **不要把密码写进提示词**：用 `auth login` 的交互式密码输入，或通过 `--password` 标志。
- **日志脱敏**：默认日志会包含 SQL 参数（如文档标题）。如需共享日志给第三方，先关 `NODE_ENV !== 'development'` 的 drizzle query logging（`db/index.ts`）。

## 错误恢复

| 错误 | 推荐处理 |
|---|---|
| 429 限流 | 退避后重试；不要并发大批量创建 |
| 401 未认证 | 自动重新登录（`docbase auth login`），再重试原命令 |
| 5xx 服务端错误 | 退避重试 3 次，每次间隔指数增长 |
| slug 冲突 | CLI 已经自动加 `-2`/`-3` 后缀，无需人工干预 |

## 性能与配额

- **创建文档**：10 / 60s / 用户（Redis 限流）
- **读操作**：无限流，但所有 `list` 接口有分页（默认 20/页）
- **冷启动**：CLI 首次调用会加载 better-auth 和 Drizzle（约 2 秒），建议在长时间运行的代理进程中复用 `ApiClient` 实例
- **批处理**：批量创建时建议 5 个并发 + 每批后 sleep 30s，避免触发限流

## 典型代理对话示例

```
User: 帮我把刚结束的搜索优化项目做个复盘，存到知识库。

Agent:
  1. 写出 Markdown 内容（含 frontmatter）
  2. 写到 /tmp/notes/search-optimization-review.md
  3. pnpm exec docbase doc create --from /tmp/notes/search-optimization-review.md
  4. 输出: Created: search-optimization-review (id=...)
  5. （可选）pnpm exec docbase doc publish search-optimization-review 发布草稿
  6. 告诉用户链接 / slug
```

## CLI 与 MCP 的对比

DocBase 当前没有 MCP server，所以 CLI 是 AI 代理访问 DocBase 的唯一路径。如果未来需要 MCP，建议：

- 直接在 MCP server 内部复用 `src/server/services/*`（服务层已经为此设计）
- 把 MCP 工具的输入输出与 CLI 命令一一对应，避免在两处维护输入格式

CLI 的输入格式（Markdown + frontmatter）对 LLM 友好——这是它对 MCP 协议的独特优势。