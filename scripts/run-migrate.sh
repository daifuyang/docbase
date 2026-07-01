#!/usr/bin/env bash
# =============================================================================
# 通过 ECS 私网跑 pnpm db:migrate，把最新 schema 写入 PG。
# 仅在 deploy 分支上跑；schedule 跳过。
# =============================================================================
set -euo pipefail

: "${APP_DB_URL:?must be set (docbase_app on private PG)}"

echo "▶ run-migrate — using DATABASE_URL env (truncated)"
echo "    host=$(echo "$APP_DB_URL" | sed -E 's#^postgres://[^@]+@([^:/]+).*#\1#')"
echo "    user=$(echo "$APP_DB_URL" | sed -E 's#^postgres://([^:]+):.*#\1#')"

export DATABASE_URL="$APP_DB_URL"

pnpm db:migrate
