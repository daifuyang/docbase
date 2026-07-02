#!/usr/bin/env bash
# =============================================================================
# DocBase FC deploy wrapper.
#
# Canonical function-code deployment flow:
#   optional preflight/migrate/admin ensure -> build -> s deploy -f fc-deploy/s.yaml
#
# Environment is read from DOCBASE_FC_ENV_FILE, defaulting to fc-deploy/prod.env.
# Set DOCBASE_SKIP_BUILD=1 when deploying an already-built fc-deploy/code package.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FC_DIR="$ROOT/fc-deploy"
ENV_FILE="${DOCBASE_FC_ENV_FILE:-$FC_DIR/prod.env}"
CMD="${1:-apply}"

log() {
  printf '▶ %s\n' "$*"
}

fail() {
  printf '✗ %s\n' "$*" >&2
  exit 1
}

load_env() {
  if [ -f "$ENV_FILE" ]; then
    log "loading FC env from ${ENV_FILE#$ROOT/}"
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  elif [ -z "${DOCBASE_FC_ENV_FILE:-}" ]; then
    fail "missing $ENV_FILE; set DOCBASE_FC_ENV_FILE or create fc-deploy/prod.env"
  else
    fail "missing DOCBASE_FC_ENV_FILE=$ENV_FILE"
  fi
}

require_env() {
  local missing=()
  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      missing+=("$name")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    fail "missing required env: ${missing[*]}"
  fi
}

s_args() {
  if [ -f "$ENV_FILE" ]; then
    printf '%s\n' --env-file "$ENV_FILE"
  fi
}

redact() {
  sed -E \
    -e 's/\x1B\[[0-9;]*[A-Za-z]//g' \
    -e 's#^([[:space:]]*)(BETTER_AUTH_SECRET|DATABASE_URL|MIGRATE_DATABASE_URL|REDIS_URL|DOCBASE_ADMIN_PASSWORD|ALIYUN_AK|ALIYUN_SK):.*#\1\2: ***REDACTED***#g'
}

run_s() {
  local action="$1"
  shift || true
  (
    cd "$FC_DIR"
    s "$action" -f s.yaml "$@" $(s_args)
  ) 2>&1 | redact
}

build_package() {
  if [ "${DOCBASE_SKIP_BUILD:-0}" = "1" ]; then
    log "skipping build because DOCBASE_SKIP_BUILD=1"
    check_package
    return
  fi
  log "typecheck"
  (cd "$ROOT" && pnpm typecheck)
  log "build"
  (cd "$ROOT" && pnpm build)
  log "assemble fc-deploy"
  (cd "$ROOT" && pnpm build:fc)
  check_package
}

check_package() {
  log "check FC artifact"
  local missing=()
  for path in \
    "$FC_DIR/code/bootstrap" \
    "$FC_DIR/code/.output/server/index.mjs" \
    "$FC_DIR/code/.output/public" \
    "$FC_DIR/code/db/migrations" \
    "$FC_DIR/code/package.json" \
    "$FC_DIR/code/fc-manifest.json"; do
    if [ ! -e "$path" ]; then
      missing+=("${path#$ROOT/}")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    fail "FC artifact incomplete: ${missing[*]}"
  fi

  if [ ! -x "$FC_DIR/code/bootstrap" ]; then
    fail "FC artifact bootstrap is not executable: fc-deploy/code/bootstrap"
  fi
}

preflight() {
  log "production preflight"
  (cd "$ROOT" && pnpm exec tsx scripts/preflight-prod.mts)
}

migrate_database() {
  log "database migrate"
  (cd "$ROOT" && bash scripts/migrate-prod.sh)
}

optional_release_steps() {
  if [ "${DOCBASE_RUN_PREFLIGHT:-0}" = "1" ]; then
    preflight
  else
    log "skip production preflight; set DOCBASE_RUN_PREFLIGHT=1 to enable"
  fi

  if [ "${DOCBASE_RUN_MIGRATIONS:-0}" = "1" ]; then
    migrate_database
  else
    log "skip database migrate; set DOCBASE_RUN_MIGRATIONS=1 to enable"
  fi
}

smoke_test() {
  local base_url="${DOCBASE_SMOKE_URL:-${PUBLIC_APP_URL:-}}"
  if [ -z "$base_url" ]; then
    log "skip smoke test: PUBLIC_APP_URL/DOCBASE_SMOKE_URL not set"
    return
  fi

  log "smoke test: ${base_url%/}/api/health"
  curl -fsSk "${base_url%/}/api/health" >/dev/null

  log "smoke test: ${base_url%/}/"
  local status
  status="$(curl -sk -o /dev/null -w '%{http_code}' "${base_url%/}/")"
  case "$status" in
    200|301|302|303|307|308) ;;
    *) fail "unexpected root status: $status" ;;
  esac
}

case "$CMD" in
  apply|deploy)
    load_env
    require_env VPC_ID VSWITCH_ID SECURITY_GROUP_ID DATABASE_URL REDIS_URL \
      BETTER_AUTH_SECRET BETTER_AUTH_URL PUBLIC_APP_URL
    optional_release_steps
    build_package
    log "deploy fc-deploy/s.yaml"
    run_s deploy -y
    smoke_test
    ;;
  plan|dry)
    load_env
    require_env VPC_ID VSWITCH_ID SECURITY_GROUP_ID DATABASE_URL REDIS_URL \
      BETTER_AUTH_SECRET BETTER_AUTH_URL PUBLIC_APP_URL
    build_package
    log "plan fc-deploy/s.yaml"
    run_s plan
    ;;
  info)
    load_env
    run_s info
    ;;
  rollback)
    load_env
    run_s rollback
    ;;
  smoke)
    load_env
    require_env PUBLIC_APP_URL
    smoke_test
    ;;
  preflight)
    load_env
    require_env DATABASE_URL REDIS_URL
    preflight
    ;;
  migrate)
    load_env
    migrate_database
    ;;
  admin)
    load_env
    require_env DATABASE_URL DOCBASE_ADMIN_EMAIL DOCBASE_ADMIN_USERNAME DOCBASE_ADMIN_PASSWORD
    ensure_admin
    ;;
  package|build)
    load_env
    build_package
    ;;
  check)
    load_env
    check_package
    ;;
  local)
    load_env
    check_package
    log "local FC runtime: http://localhost:9000"
    run_s local start
    ;;
  *)
    cat >&2 <<'EOF'
usage: scripts/deploy-fc.sh {apply|plan|info|rollback|smoke|preflight|migrate|admin|package|check|local}

env:
  DOCBASE_FC_ENV_FILE       defaults to fc-deploy/prod.env
  DOCBASE_SKIP_BUILD        set to 1 to deploy an existing fc-deploy/code package
  DOCBASE_RUN_PREFLIGHT     set to 1 to run production DB/Redis checks before deploy
  DOCBASE_RUN_MIGRATIONS    set to 1 to run migrations before deploy
  DOCBASE_RUN_ADMIN_ENSURE  set to 1 to ensure the production admin before deploy
  DOCBASE_SMOKE_URL         override PUBLIC_APP_URL for smoke tests
EOF
    exit 1
    ;;
esac
