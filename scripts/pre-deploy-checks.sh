#!/usr/bin/env bash
# =============================================================================
# 部署前联通检查：确认 runner 私网能连到 ECS PG、Redis，且 aliyun CLI
# 能连到生产 API (cn-shanghai)。
# =============================================================================
set -euo pipefail

: "${APP_DB_URL:?must be set (APP_DB_URL = docbase_app on private PG)}"
: "${REDIS_APP_URL:?must be set (REDIS_APP_URL = docbase_app on private Redis)}"
: "${ALIYUN_AK:?must be set}"
: "${ALIYUN_SK:?must be set}"

echo "▶ pre-deploy checks"

# 1) PG
echo "  · psql sanity"
PGPASSWORD="$(echo "$APP_DB_URL" | sed -E 's#^postgres://[^:]+:([^@]+)@.*#\1#')" \
  psql "$APP_DB_URL" -c 'select 1 as ok;' | tee /dev/stderr | grep -q '1' || {
    echo "✗ PG NOT REACHABLE on $APP_DB_URL" >&2
    exit 1
  }

# 2) Redis (用 docbase_app)
echo "  · redis-cli sanity"
REDIS_PASS="$(echo "$REDIS_APP_URL" | sed -E 's#^redis://[^@/]+@##; s#/.*##')"
redis-cli -u "$REDIS_APP_URL" --no-auth-warning ping | grep -q PONG || {
  echo "✗ Redis NOT REACHABLE on $REDIS_APP_URL" >&2
  exit 1
}

# 3) Aliyun API
echo "  · aliyun whoami"
aliyun sts GetCallerIdentity >/dev/null || {
  echo "✗ aliyun STS GetCallerIdentity failed" >&2
  exit 1
}

# 4) FC API
echo "  · aliyun FC ListServices (region=${DOCBASE_REGION:-cn-shanghai})"
aliyun fc ListServices --region "${DOCBASE_REGION:-cn-shanghai}" >/dev/null || {
  echo "✗ aliyun FC ListServices failed" >&2
  exit 1
}

echo "✓ pre-deploy checks passed"
