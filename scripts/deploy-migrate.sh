#!/usr/bin/env bash
# =============================================================================
# DocBase FC deploy wrapper — migration runner.
#
# Canonical function-code deployment flow:
#   build (node scripts/build-migrate.mjs) → s deploy -f fc-deploy-migrate/s.yaml
#
# Environment is read from DOCBASE_MIGRATE_ENV_FILE, defaulting to
# fc-deploy-migrate/prod.env.
#
# Usage:
#   bash scripts/deploy-migrate.sh apply
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="$ROOT/fc-deploy-migrate"
ENV_FILE="${DOCBASE_MIGRATE_ENV_FILE:-$UNIT_DIR/prod.env}"
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
    log "loading migrate env from ${ENV_FILE#$ROOT/}"
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  elif [ -z "${DOCBASE_MIGRATE_ENV_FILE:-}" ]; then
    fail "missing $ENV_FILE; set DOCBASE_MIGRATE_ENV_FILE or create fc-deploy-migrate/prod.env"
  else
    fail "missing DOCBASE_MIGRATE_ENV_FILE=$ENV_FILE"
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

check_artifact() {
  local missing=()
  for path in \
    "$UNIT_DIR/code/index.mjs" \
    "$UNIT_DIR/code/bootstrap" \
    "$UNIT_DIR/code/db/migrations"; do
    if [ ! -e "$path" ]; then
      missing+=("${path#$ROOT/}")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    fail "migrate artifact incomplete: ${missing[*]}"
  fi
}

case "$CMD" in
  apply|deploy)
    load_env
    require_env VPC_ID VSWITCH_ID SECURITY_GROUP_ID DATABASE_SUPERUSER_URL
    log "build migrate artifact"
    node scripts/build-migrate.mjs
    check_artifact
    log "deploy fc-deploy-migrate/s.yaml"
    npx s deploy -y $(s_args)
    log "smoke: invoke migrate-runner"
    local endpoint
    endpoint=$(npx s info $(s_args) 2>/dev/null | sed -n 's/.*urlInternet:[[:space:]]*//p' | head -1 || true)
    if [ -z "$endpoint" ]; then
      log "  (couldn't auto-resolve endpoint — trigger via Actions → DB Migrate)"
    else
      log "  POST $endpoint/"
      if curl -fsS -X POST --max-time 120 "$endpoint/"; then
        log "✅ migrate succeeded"
      else
        log "✗ migrate invocation failed (status=$?)"
        exit 1
      fi
    fi
    ;;
  *)
    cat >&2 <<'EOF'
usage: scripts/deploy-migrate.sh {apply}

env:
  DOCBASE_MIGRATE_ENV_FILE  defaults to fc-deploy-migrate/prod.env
EOF
    exit 1
    ;;
esac