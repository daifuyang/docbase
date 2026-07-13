#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DOCBASE_FC_ENV_FILE:-$ROOT/fc-deploy/prod.env}"

log() {
  printf '▶ %s\n' "$*"
}

fail() {
  printf '✗ %s\n' "$*" >&2
  exit 1
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

load_env() {
  if [ -f "$ENV_FILE" ]; then
    log "loading env from ${ENV_FILE#$ROOT/}"
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  fi
}

load_env

require_env DOCBASE_DOMAIN DOCBASE_DOMAIN_CERT_NAME

RENEW_DAYS="${RENEW_DAYS:-30}"
DOCBASE_DNS_PROFILE="${DOCBASE_DNS_PROFILE:-personal}"
DOCBASE_ALIYUN_CERT_PROFILE="${DOCBASE_ALIYUN_CERT_PROFILE:-enterprise}"

log "checking CAS certificate expiry for ${DOCBASE_DOMAIN}"
cert_list_json="$(aic aliyun-cert:list --type UPLOAD -p "$DOCBASE_ALIYUN_CERT_PROFILE")"

eval "$(
  CERT_LIST_JSON="$cert_list_json" \
  DOCBASE_DOMAIN="$DOCBASE_DOMAIN" \
  RENEW_DAYS="$RENEW_DAYS" \
    node <<'NODE'
const data = JSON.parse(process.env.CERT_LIST_JSON || '{}')
const certs = Array.isArray(data.certificates) ? data.certificates : []
const domain = process.env.DOCBASE_DOMAIN
const renewDays = Number(process.env.RENEW_DAYS || '30')
const now = Date.now()
const threshold = now + renewDays * 24 * 60 * 60 * 1000

const matched = certs
  .filter((cert) => cert && cert.commonName === domain && cert.endDate)
  .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())

const latest = matched[0]
const latestEndMs = latest ? new Date(latest.endDate).getTime() : 0
const renewNeeded = !latest || Number.isNaN(latestEndMs) || latestEndMs <= threshold

if (latest) {
  console.log(`CURRENT_CERT_ID=${JSON.stringify(String(latest.certId ?? ''))}`)
  console.log(`CURRENT_CERT_END_DATE=${JSON.stringify(String(latest.endDate ?? ''))}`)
}

console.log(`RENEW_NEEDED=${renewNeeded ? '1' : '0'}`)
NODE
)"

if [ "${RENEW_NEEDED:-1}" != "1" ]; then
  log "current certificate is still valid until ${CURRENT_CERT_END_DATE:-unknown}; skip renewal"
  exit 0
fi

log "issuing a new certificate for ${DOCBASE_DOMAIN}"
issue_json="$(aic cert:issue "$DOCBASE_DOMAIN" -d aliyun -p "$DOCBASE_DNS_PROFILE")"

eval "$(
  ISSUE_JSON="$issue_json" node <<'NODE'
const data = JSON.parse(process.env.ISSUE_JSON || '{}')
console.log(`CERT_PATH=${JSON.stringify(String(data.certPath ?? ''))}`)
console.log(`KEY_PATH=${JSON.stringify(String(data.keyPath ?? ''))}`)
NODE
)"

[ -n "${CERT_PATH:-}" ] || fail "missing certPath from aic cert:issue"
[ -f "$CERT_PATH" ] || fail "certificate file not found: $CERT_PATH"
[ -n "${KEY_PATH:-}" ] || fail "missing keyPath from aic cert:issue"
[ -f "$KEY_PATH" ] || fail "private key file not found: $KEY_PATH"

cert_name="${DOCBASE_DOMAIN_CERT_NAME}-$(date +%Y%m%d)"

log "uploading the renewed certificate to Aliyun CAS as ${cert_name}"
aic aliyun-cert:upload "$cert_name" "$CERT_PATH" "$KEY_PATH" -p "$DOCBASE_ALIYUN_CERT_PROFILE" >/tmp/docbase-cert-upload.json

log "updating FC custom domain binding"
DOCBASE_DOMAIN_CERT_NAME="$cert_name" \
DOCBASE_DOMAIN_CERT_FILE="$CERT_PATH" \
DOCBASE_DOMAIN_KEY_FILE="$KEY_PATH" \
DOCBASE_FC_ENV_FILE="$ENV_FILE" \
  bash "$ROOT/scripts/deploy-fc.sh" domain-apply

log "FC custom domain certificate updated"
