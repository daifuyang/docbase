#!/usr/bin/env bash
# =============================================================================
# DocBase — docbase.zerocmf.com 一次性落地 + 续签脚本
# 凭证拆账号：
#   - 个人凭证（`default`  profile，账号 1979546277537140）: alidns 写
#   - 企业凭证（`enterprise` profile，账号 1650595695532785）: CAS / FC
# CAS / alidns 的 endpoint 强制指定避免 CLI plugin 选错 region。
#
# 用法：
#   bash scripts/aliyun-docbase-deploy.local.sh issue    # acme.sh 签 + CAS 上传
#   bash scripts/aliyun-docbase-deploy.local.sh dns       # 加 CNAME（已存在则更新）
#   bash scripts/aliyun-docbase-deploy.local.sh fcdom     # 重建 FC custom-domain
#   bash scripts/aliyun-docbase-deploy.local.sh all       # 一条龙
#   bash scripts/aliyun-docbase-deploy.local.sh cleanup   # 删除所有（用于实验）
# =============================================================================
set -euo pipefail

DOMAIN="docbase.zerocmf.com"
PARENT_ZONE="zerocmf.com"
FC_ENDPOINT="1650595695532785.cn-shanghai.fc.aliyuncs.com"
ACME_DIR="$HOME/.acme.sh/${DOMAIN}"
CERT_FILE="${ACME_DIR}/${DOMAIN}.cer"
KEY_FILE="${ACME_DIR}/${DOMAIN}.key"
FULLCHAIN_FILE="${ACME_DIR}/fullchain.cer"
CD_PROFILE=default      # personal, for alidns
ENT_PROFILE=enterprise  # enterprise, for CAS + FC
ENT_AK=$(jq -r '.profiles[] | select(.name=="'${ENT_PROFILE}'") | .access_key_id'  ~/.aliyun/config.json)
ENT_SK=$(jq -r '.profiles[] | select(.name=="'${ENT_PROFILE}'") | .access_key_secret' ~/.aliyun/config.json)

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
err() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

require_files() {
  if [ ! -f "$FULLCHAIN_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    err "缺少 ${FULLCHAIN_FILE} / ${KEY_FILE}，请先运行 issue 子命令"
    exit 1
  fi
}

# -------- 1. 证书签 + 上传 --------
cmd_issue() {
  log "1) acme.sh --issue --dns dns_ali (personal alidns)"
  if [ ! -d "$ACME_DIR" ] || [ ! -f "$FULLCHAIN_FILE" ]; then
    ~/.acme.sh/acme.sh \
      --issue -d "$DOMAIN" --dns dns_ali \
      --keylength 2048 --server letsencrypt \
      --dnssleep 30
  else
    echo "  现有证书，跳过签发（renewal 请用 renew 子命令）"
  fi

  log "2) 上传 CAS (enterprise)"
  require_files
  CERT_BODY=$(cat "$FULLCHAIN_FILE")
  KEY_BODY=$(cat "$KEY_FILE")
  CERT_NAME="${DOMAIN}-$(date +%Y%m%d-%H%M%S)"
  OUT=$(aliyun cas upload-user-certificate \
    --name "$CERT_NAME" \
    --cert "$CERT_BODY" \
    --key "$KEY_BODY" \
    --endpoint cas.aliyuncs.com \
    --profile "$ENT_PROFILE")
  echo "$OUT"
  CERT_ID=$(echo "$OUT" | jq -r '.CertId // empty')
  if [ -z "$CERT_ID" ]; then
    err "上传失败，response: $OUT"; exit 1
  fi
  echo "  uploaded CertId=$CERT_ID Name=$CERT_NAME"
  echo "$CERT_NAME" > /tmp/docbase-cert.name
  echo "$CERT_ID"    > /tmp/docbase-cert.id
}

cmd_renew() {
  log "renew via acme.sh"
  ~/.acme.sh/acme.sh --renew -d "$DOMAIN" --dns dns_ali --force --server letsencrypt
  cmd_issue
  cmd_fcdom
  log "renew done — 旧 cert 仍在 CAS 但不再使用，30 天后用 cas delete-user-certificate 清掉"
}

# -------- 2. DNS 加/更新 --------
cmd_dns() {
  log "DNS AddDomainRecord (default profile, personal alidns)"
  EXISTING=$(aliyun alidns DescribeDomainRecords \
    --DomainName "$PARENT_ZONE" --RRKeyWord docbase \
    --profile "$CD_PROFILE" 2>&1 \
    | jq -r '.DomainRecords.Record[] | select(.RR=="docbase") | .RecordId // empty')
  if [ -n "$EXISTING" ]; then
    log "  更新已有 recordId=$EXISTING"
    aliyun alidns UpdateDomainRecord \
      --RecordId "$EXISTING" \
      --RR docbase --Type CNAME --Value "$FC_ENDPOINT" --TTL 600 \
      --profile "$CD_PROFILE"
  else
    aliyun alidns AddDomainRecord \
      --DomainName "$PARENT_ZONE" --RR docbase --Type CNAME \
      --Value "$FC_ENDPOINT" --TTL 600 \
      --profile "$CD_PROFILE"
  fi

  log "DNS 验证（8.8.8.8）"
  sleep 10
  dig +short "$DOMAIN" CNAME @8.8.8.8 | head -1
}

# -------- 3. FC custom-domain --------
cmd_fcdom() {
  log "FC create-custom-domain (enterprise)"
  if [ -z "$(cat /tmp/docbase-cert.name 2>/dev/null)" ]; then
    err "未发现 /tmp/docbase-cert.name，先跑 issue 子命令"
    exit 1
  fi
  CERT_NAME=$(cat /tmp/docbase-cert.name)
  CERT_ID=$(cat /tmp/docbase-cert.id)
  CERT_BODY=$(cat "$FULLCHAIN_FILE")
  KEY_BODY=$(cat "$KEY_FILE")

  # 优先用 certName（certConfig 让 FC 自己找），如果 FC 还要求 inline cert，则同时传
  PAYLOAD=$(jq -n \
    --arg cn "$CERT_NAME" \
    --arg cert "$CERT_BODY" \
    --arg key  "$KEY_BODY" \
    '{"domainName":"'$DOMAIN'","protocol":"HTTPS","certConfig":{"certName":$cn,"certificate":$cert,"privateKey":$key},"routeConfig":{"routes":[{"functionName":"docbase-web","path":"/*","qualifier":"LATEST"}]}}')

  # 先检查是否已存在
  EXIST=$(aliyun fc get-custom-domain --domain-name "$DOMAIN" --region cn-shanghai --profile "$ENT_PROFILE" 2>&1 | head -1)
  if echo "$EXIST" | grep -q '"domainName"'; then
    log "  已存在，删除重建"
    aliyun fc delete-custom-domain --domain-name "$DOMAIN" --region cn-shanghai --profile "$ENT_PROFILE"
  fi

  aliyun fc create-custom-domain \
    --body "$PAYLOAD" \
    --region cn-shanghai --profile "$ENT_PROFILE"
}

cmd_all() {
  cmd_issue
  cmd_dns
  cmd_fcdom
  log "✅ 全部就绪：https://${DOMAIN}/ 现在会回 FC 404（缺 docbase-web 函数），把函数代码 push 后即通"
}

cmd_cleanup() {
  log "WARNING: 删除所有 docbase.zerocmf.com 资源"
  if [ -t 1 ]; then read -rp "Press enter to continue (or ^C to abort): "; fi
  # (a) FC custom-domain
  aliyun fc delete-custom-domain --domain-name "$DOMAIN" --region cn-shanghai --profile "$ENT_PROFILE" 2>&1 || true
  # (b) DNS record
  R=$(aliyun alidns DescribeDomainRecords --DomainName "$PARENT_ZONE" --RRKeyWord docbase --profile "$CD_PROFILE" \
      | jq -r '.DomainRecords.Record[] | select(.RR=="docbase") | .RecordId')
  if [ -n "$R" ]; then
    aliyun alidns DeleteDomainRecord --RecordId "$R" --profile "$CD_PROFILE"
  fi
  # (c) CAS cert
  if [ -f /tmp/docbase-cert.id ]; then
    aliyun cas delete-user-certificate --cert-id "$(cat /tmp/docbase-cert.id)" \
      --profile "$ENT_PROFILE" --endpoint cas.aliyuncs.com 2>&1 || true
  fi
  log "cleanup 完成"
}

case "${1:-all}" in
  issue)   cmd_issue ;;
  renew)   cmd_renew ;;
  dns)     cmd_dns ;;
  fcdom)   cmd_fcdom ;;
  all)     cmd_all ;;
  cleanup) cmd_cleanup ;;
  *) echo "usage: $0 {issue|renew|dns|fcdom|all|cleanup}"; exit 1 ;;
esac
