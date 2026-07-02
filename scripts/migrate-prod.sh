#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL="${MIGRATE_DATABASE_URL:-${DATABASE_URL:-}}"

if [ -z "$DB_URL" ]; then
  printf '✗ missing DATABASE_URL or MIGRATE_DATABASE_URL\n' >&2
  exit 1
fi

if [ -z "${MIGRATE_DATABASE_URL:-}" ]; then
  printf '▶ MIGRATE_DATABASE_URL not set; falling back to DATABASE_URL\n'
fi

export DATABASE_URL="$DB_URL"
cd "$ROOT"
pnpm db:migrate
