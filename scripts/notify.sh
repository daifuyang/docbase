#!/usr/bin/env bash
# =============================================================================
# 部署结果通知：飞书/钉钉 webhook（任选其一）。
# 失败通知走 alert 频道，成功走 general 频道。
# Webhook URL 通过 env-config 加载后再传进来。
# =============================================================================
set -euo pipefail

STATUS="${1:-success}"
: "${DOCBASE_DOMAIN:?must be set}"
: "${GITHUB_REPO:?must be set}"
: "${GITHUB_RUN_ID:?must be set}"

# 简单钉钉 webhook (依赖 ENV: WEBHOOK_URL)
WEBHOOK="${WEBHOOK_URL:-}"
if [ -z "$WEBHOOK" ]; then
  echo "skip — WEBHOOK_URL not set"
  exit 0
fi

EMOJI=$([ "$STATUS" = "success" ] && echo "✅" || echo "❌")
COLOR=$([ "$STATUS" = "success" ] && echo "good" || echo "warning")
TEXT="**DocBase deploy** $EMOJI
- Status: $STATUS
- Domain: https://$DOCBASE_DOMAIN
- Repo: $GITHUB_REPO
- Run: https://github.com/$GITHUB_REPO/actions/runs/$GITHUB_RUN_ID"

case "$WEBHOOK_KIND" in
  dingtalk)
    curl -fsS "$WEBHOOK" \
      -H 'content-type: application/json' \
      -d "$(jq -n --arg text "$TEXT" --arg status "$COLOR" \
          '{msgtype:"markdown",markdown:{title:"DocBase",text:$text}}')" \
      >/dev/null
    ;;
  feishu|lark)
    curl -fsS "$WEBHOOK" \
      -H 'content-type: application/json' \
      -d "$(jq -n --arg text "$TEXT" --arg status "$COLOR" \
          '{msg_type:"interactive",card:{header:{title:{tag:"plain_text",content:"DocBase deploy"},template:$status},elements:[{tag:"markdown",content:$text}]}}')" \
      >/dev/null
    ;;
  slack)
    curl -fsS "$WEBHOOK" \
      -H 'content-type: application/json' \
      -d "$(jq -n --arg text "$TEXT" --arg color "$COLOR" \
          '{attachments:[{color:$color,text:$text}]}')" \
      >/dev/null
    ;;
  *)
    echo "skip — unknown WEBHOOK_KIND=$WEBHOOK_KIND"
    ;;
esac

echo "✓ notified ($STATUS)"
