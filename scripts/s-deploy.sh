#!/usr/bin/env bash
# =============================================================================
# 包装 npx s deploy / s plan / s info，统一从 runner 本地的
# .env.deploy 注入凭证。
#
# env-config 已经把敏感 key 加载到 runner process env；
# 这里再把它们写到临时 .env 文件，让 s.yaml 能引用 `${env.X}`。
# =============================================================================
set -euo pipefail

: "${ALIYUN_AK:?must be set}"
: "${ALIYUN_SK:?must be set}"
: "${APP_DB_URL:?must be set}"
: "${REDIS_APP_URL:?must be set}"
: "${BETTER_AUTH_SECRET:?must be set}"
: "${FC_VPC_ID:?must be set}"
: "${FC_VSW_ID:?must be set}"
: "${FC_SG_ID:?must be set}"
: "${FC_NAT_ID:?must be set}"
: "${CAS_CERT_ID:?must be set}"

CMD="${1:-apply}"
ENV_FILE="$(mktemp -t docbase-env-XXXXXX)"

cat >"$ENV_FILE" <<EOF
ALIYUN_AK=$ALIYUN_AK
ALIYUN_SK=$ALIYUN_SK
APP_DB_URL=$APP_DB_URL
REDIS_APP_URL=$REDIS_APP_URL
BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
FC_VPC_ID=$FC_VPC_ID
FC_VSW_ID=$FC_VSW_ID
FC_SG_ID=$FC_SG_ID
FC_NAT_ID=$FC_NAT_ID
CERT_ID=$CAS_CERT_ID
EOF
chmod 600 "$ENV_FILE"
trap 'rm -f "$ENV_FILE"' EXIT

export ALIYUN_CONFIG_FILE="$HOME/.aliyun/config.json"

case "$CMD" in
  plan)
    npx -p @serverless-devs/s s plan \
      -f s.yaml --env-file "$ENV_FILE" --debug 2>&1
    ;;
  apply)
    npx -p @serverless-devs/s s deploy \
      -f s.yaml --env-file "$ENV_FILE" -y --debug 2>&1
    ;;
  info)
    npx -p @serverless-devs/s s info \
      -f s.yaml --env-file "$ENV_FILE" 2>&1
    ;;
  rollback)
    npx -p @serverless-devs/s s rollback \
      -f s.yaml --env-file "$ENV_FILE" 2>&1
    ;;
  *)
    echo "usage: $0 {plan|apply|info|rollback}" >&2
    exit 1
    ;;
esac
