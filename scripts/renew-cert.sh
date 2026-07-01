#!/usr/bin/env bash
# =============================================================================
# 证书续签流程：
#   1) certbot certonly --standalone (or --dns 阿里云 DNS plugin) 给 docbase.zerocmf.com 续签；
#   2) 用 aliyun cas UploadSSLCertificate 上传 fullchain.pem + privkey.pem;
#   3) 把返回的 certId 写到 $GITHUB_ENV 供下游 docbase-cert-ref 使用。
#
# 这里默认采用 Let's Encrypt + dns-aliyun plugin (因为 FC 不能 80/443 入口硬绑）；
# 如果跨平台复杂，可改为 acme.sh + aliyun-dns hook。
#
# 注意：本步骤会消费 ENVCFG_PROFILE 在 .aliyun 里写的两个 secret：
#   ALIYUN_AK / ALIYUN_SK (主账号 RAM 子账号足够权限)
# =============================================================================
set -euo pipefail

: "${LE_EMAIL:?must be set}"
: "${CERT_DOMAIN:?must be set (e.g. docbase.zerocmf.com)}"
: "${CAS_CERT_ID:?may be empty for first-time run}"

DOMAIN_ROOT="${CERT_DOMAIN#*.}"
LE_DIR=/etc/letsencrypt/live/"$CERT_DOMAIN"

echo "▶ renew-cert — domain=$CERT_DOMAIN root=$DOMAIN_ROOT"

if ! command -v certbot >/dev/null 2>&1; then
  echo "✗ certbot missing — install first" >&2
  exit 1
fi

# 1) DNS 续签（避免占用 80 端口）
certbot certonly \
  --non-interactive --agree-tos \
  --email "$LE_EMAIL" \
  --authenticator dns-aliyun \
  --dns-aliyun-credentials "$HOME/.aliyun/cred.ini" \
  --dns-aliyun-propagation-seconds 30 \
  -d "$CERT_DOMAIN" -d "*.$CERT_DOMAIN" 2>&1 | tail -5

# 2) 上传到 CAS
ls "$LE_DIR/fullchain.pem" "$LE_DIR/privkey.pem" >/dev/null

NEW_CERT_ID=$(aliyun cas UploadSSLCertificate \
  --region cn-shanghai \
  --name "docbase-$(date -u +%Y%m%dT%H%M%SZ)" \
  --Domain "$CERT_DOMAIN" \
  --Cert "$(cat "$LE_DIR/fullchain.pem")" \
  --Key  "$(cat "$LE_DIR/privkey.pem")" \
  --output json \
  | jq -r '.CertId')

if [ -z "$NEW_CERT_ID" ] || [ "$NEW_CERT_ID" = "null" ]; then
  echo "✗ UploadSSLCertificate failed" >&2
  exit 1
fi
echo "✓ uploaded CertId=$NEW_CERT_ID"
CAS_CERT_ID="$NEW_CERT_ID"

# 3) 写回 env（供 docbase-cert-ref 引用）
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "CAS_CERT_ID=$CAS_CERT_ID" >>"$GITHUB_ENV"
fi
