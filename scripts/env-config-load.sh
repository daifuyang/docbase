#!/usr/bin/env bash
# =============================================================================
# 把 env-config 里的键值加载到 GitHub Actions 的 $GITHUB_ENV，
# 使下游 step 可以 ${{ env.X }} 拿到。
#
# 注意点：
#   - 输出必须写成 >> "$GITHUB_ENV" 的形式（key=value 行）；
#   - 不能打印 secret 值本身；
#   - ENVCFG_KEYS 是个逗号分隔列表，env-config get 通过 --key 逐项取。
#
# 凭证在 VPS runner 的 `~/.aliyun/config.json` 里，env-config 是
# 阿里云官方 CLI set-config/get-config（用 Python 包装）。
# =============================================================================
set -euo pipefail

: "${ENVCFG_PROFILE:=docbase-prod}"
: "${ENVCFG_KEYS:?must be set (comma-separated env-config keys)}"

if ! command -v env-config >/dev/null 2>&1; then
  echo "✗ env-config CLI missing — install via 'pip install aliyun-cli' or 'npm i -g @alicloud/fun'" >&2
  exit 1
fi

if [ -z "${GITHUB_ENV:-}" ]; then
  echo "✗ GITHUB_ENV not set — not a runner context" >&2
  exit 1
fi

IFS=',' read -ra KEYS <<<"$ENVCFG_KEYS"
for KEY in "${KEYS[@]}"; do
  KEY=$(echo "$KEY" | xargs)  # trim
  VAL=$(env-config get --profile "$ENVCFG_PROFILE" --key "$KEY" 2>/dev/null || echo "")
  if [ -z "$VAL" ]; then
    echo "✗ env-config: missing key '$KEY' under profile '$ENVCFG_PROFILE'" >&2
    exit 1
  fi
  # 输出到 runner env (下游 step 通过 :env: 取)
  # 替换任何换行符为 \n，避免破坏 KEY=VAL 格式
  ESCAPED=$(printf '%s' "$VAL" | tr '\n' ' ')
  echo "$KEY=$ESCAPED" >>"$GITHUB_ENV"
done

echo "✓ env-config: loaded ${#KEYS[@]} keys into runner env"
