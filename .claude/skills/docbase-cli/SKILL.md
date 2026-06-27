---
name: docbase-cli
description: Drive the DocBase CLI from the shell to read, write, search, and publish documents in the team's internal knowledge base. Use this skill whenever the user mentions DocBase, the knowledge base, the wiki, internal docs, or asks to "save this to docbase", "publish a doc", "write a note to the wiki", "post a write-up", "look up X in our docs", "create a knowledge article", or any similar phrasing. Also trigger when the user asks an agent to summarize a piece of work and persist the summary so the team can find it later. Do NOT use this skill for editing local files only — only when the destination is the DocBase knowledge base.
---

# DocBase CLI

The DocBase CLI (`docbase`) is the canonical way for AI agents and scripts to read, write, and publish documents in the team's internal DocBase knowledge base without booting the web server. The CLI is wired into the DocBase monorepo's `package.json` `bin` field — invoke it as `pnpm exec docbase <cmd>` from anywhere in the repo. Under the hood it runs the same service-layer code (`src/server/services/*`) that the web UI calls, so validation, permission checks, rate limits, and Markdown → TipTap conversion all behave identically to the Web.

Full long-form docs:

- `docs/cli/README.md` — full command reference, troubleshooting table, output / exit-code conventions
- `docs/cli/ai-integration.md` — recipes for hooking the CLI into agent workflows (research notes, git hooks, batch import)

Reach for those when this skill is silent or you need an edge case.

---

## When this skill should fire

Use it for **any** of:

- The user wants to create, list, search, get, update, publish, or delete a DocBase document.
- The user says "save to the knowledge base", "post to wiki", "publish a write-up", "internal docs", "团队知识库", "沉淀一下", etc.
- You (the agent) just finished a piece of research / code review / incident analysis and want to persist the conclusion.
- A commit hook, CI step, or scheduled job needs to write structured notes into DocBase.
- The user wants to look something up that might live in the team's internal docs.

Do **not** fire this skill for plain local-file writes, ephemeral notes, or anything whose destination is not DocBase.

---

## Authentication

The CLI uses better-auth's `@better-auth/api-key` plugin. Users authenticate **once** with their username + password and the CLI persists a long-lived API key to disk. Subsequent commands reuse the key silently.

**Before any other command can succeed, the user must have run `docbase auth login`.** If you see `UNAUTHENTICATED` (exit code 4), walk the user through login.

```bash
# Interactive password prompt (recommended)
pnpm exec docbase auth login --username <username>

# Non-interactive (be mindful of shell history)
pnpm exec docbase auth login --username admin --password 'admin123' --name "alice-laptop"
```

Credential file: `~/.config/docbase/credentials.json` (mode 0600). Override path with `DOCBASE_CREDENTIALS_PATH` for tests.

Verify auth with `pnpm exec docbase auth whoami`. Tear down with `pnpm exec docbase auth logout` (this also revokes the key server-side).

> **For AI agents:** always create a **dedicated API key** per agent (`--name "agent-x"`) so it can be audited and revoked independently in the admin panel. Use a `member`-role user, never admin, unless the agent truly needs governance APIs.

---

## Core command recipes

All commands accept `--json` for machine-readable output. Most also accept `--no-color` and `-v` (`--verbose`).

### Read

```bash
# Search by keyword (matches title, excerpt, JSON content)
pnpm exec docbase doc search "<query>" --json

# List published documents (default), filter by space/category/tag/status
pnpm exec docbase doc list --status published
pnpm exec docbase doc list --space engineering --tag cli
pnpm exec docbase doc list --page 2 --page-size 10

# List drafts you own
pnpm exec docbase doc list --status draft --mine

# Get one document by slug (returns contentHtml)
pnpm exec docbase doc get <slug> --json

# Browse structure
pnpm exec docbase space list --json
pnpm exec docbase tag list --json
```

### Create from Markdown

The Markdown body must include YAML frontmatter. Supported fields:

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Becomes slug automatically; collisions auto-suffix (`-2`, `-3`, …) |
| `tags` | no | YAML list of strings |
| `status` | no | `draft` (default) or `published` |
| `space` | no | Space slug or display name |
| `category` | no | Category slug or display name |

Body supports GFM Markdown: headings, bold/italic/inline-code, links, images, ordered/unordered lists, fenced code blocks, blockquotes. Tables / footnotes / embeds are **not** in v1.

```bash
# From file
pnpm exec docbase doc create --from /path/to/post.md

# From stdin (useful in agent pipelines)
cat <<'EOF' | pnpm exec docbase doc create --stdin
---
title: 搜索体验迭代复盘
tags: [search, review]
status: draft
space: 工程知识库
---

# 背景
本月我们把搜索相关性的 NDCG 从 0.71 提升到了 0.83。
EOF

# CLI flags override frontmatter (use this when the agent already has the
# title / tags / status as separate structured fields)
pnpm exec docbase doc create --from post.md --status published --tags cli,urgent

# Pipe the result straight into jq / next command
pnpm exec docbase doc create --from post.md --json | jq -r '.document.slug'
```

A small helper script lives at `scripts/create-from-file.sh` — call it instead of inlining the command when you need to create many documents.

### Update

```bash
# Replace content + title from a new file
pnpm exec docbase doc update <slug> --from post-v2.md

# Patch metadata only (no body change)
pnpm exec docbase doc update <slug> \
  --title "新标题" \
  --tags "复盘,release,final"
```

### Publish / delete

```bash
# Promote a draft to published
pnpm exec docbase doc publish <slug>

# Delete (TTY asks for confirmation; pass --yes in non-interactive use)
pnpm exec docbase doc delete <slug>
pnpm exec docbase doc delete <slug> --yes
```

---

## Exit codes (treat these as the contract)

| Code | Meaning | Recovery |
|---|---|---|
| 0 | Success | — |
| 1 | Internal error | Retry once; surface stderr to user |
| 2 | Validation error (bad input) | Fix the input; do not retry |
| 3 | Unknown error | Surface stderr |
| 4 | 401 — not authenticated or invalid API key | Re-run `auth login`, then retry the original command |
| 5 | 403 — forbidden (e.g. trying to edit another author's doc) | Surface to user; do not retry |
| 6 | 429 — rate limited (10 doc creates / 60s per user, fixed window) | Sleep until the `retry after` timestamp and retry |

For batch operations, always check `$?` and apply the recovery above. Don't blindly retry — 429 will only resolve by waiting, and 401 needs a re-login.

---

## Common agent workflows

### Persist a research conclusion

After any non-trivial investigation, write the conclusion as Markdown and create it. Suggested frontmatter:

```yaml
---
title: <one-line summary>
tags: [investigation, <relevant area>]
status: draft   # let a human review before publishing
space: <the space it belongs to>
---
```

Then run `pnpm exec docbase doc create --from /tmp/notes.md --json` and report the returned slug to the user.

### Look up existing context before answering

Before suggesting a solution that might already exist in the team's docs, search:

```bash
pnpm exec docbase doc search "<topic keywords>" --json | jq '.items[] | {slug, title, excerpt}'
```

This avoids re-deriving answers the team has already documented.

### Batch import / cron sync

```bash
for f in /path/to/notes/*.md; do
  pnpm exec docbase doc create --from "$f" --json \
    | jq -r '"imported: " + .document.slug'
done
```

To stay under the 10/60s rate limit, add `sleep 7` between iterations or chunk the loop into batches of 5 with a 30-second pause between batches.

### Commit-message → knowledge-base

```bash
{
  echo "---"
  echo "title: $(git log -1 --pretty=%s)"
  echo "tags: [git, $(git rev-parse --abbrev-ref HEAD)]"
  echo "status: draft"
  echo "space: 工程知识库"
  echo "---"
  echo ""
  git log -1 --pretty=%B
} > /tmp/commit-note.md
pnpm exec docbase doc create --from /tmp/commit-note.md
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `UNAUTHENTICATED` (exit 4) | Not logged in, or key was revoked server-side | `pnpm exec docbase auth login` |
| `Failed query: insert into "document" ... duplicate key` | Slug already exists in that space | CLI auto-suffixes with `-2`, `-3`; check the slug in the response and don't try to insert manually |
| `Rate limit exceeded` (exit 6) | More than 10 doc creates in 60s | Wait for the retry-after window shown in stderr, then retry |
| `--status published` ignored on create | Older CLI versions had a default; ensure you're on the latest build (`pnpm exec docbase --version`) | Frontmatter `status: published` is honored when `--status` flag is not given |
| Markdown formatting lost in DocBase | v1 only supports GFM (no tables / footnotes / embeds) | Simplify to headings + lists + code blocks; see `docs/cli/README.md` for the supported subset |
| Drizzle query log floods stderr | Default behavior in development mode | Pass `-q` to suppress, or set `NODE_ENV=production` |

---

## Cross-references

- Long-form command reference: `docs/cli/README.md`
- AI integration recipes: `docs/cli/ai-integration.md`
- Service-layer source of truth: `src/server/services/documents.ts`
- CLI implementation: `src/cli/`
- Auth / API-key plugin wiring: `src/lib/auth.server.ts`