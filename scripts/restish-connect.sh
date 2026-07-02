#!/usr/bin/env bash
set -euo pipefail

API_NAME="${DOCBASE_RESTISH_NAME:-docbase}"
BASE_URL="${DOCBASE_API_URL:-https://docbase.zerocmf.com}"
SPEC_URL="${DOCBASE_OPENAPI_SPEC:-${BASE_URL%/}/api/v1/openapi}"

if ! command -v restish >/dev/null 2>&1; then
  cat >&2 <<'EOF'
restish is not installed.

Install the official CLI first:
  brew install restish

or:
  go install github.com/rest-sh/restish/v2/cmd/restish@latest
EOF
  exit 127
fi

args=(api connect "$API_NAME" "$BASE_URL")
if [ -n "${DOCBASE_API_KEY:-}" ]; then
  args+=("prompt.api_key: env:DOCBASE_API_KEY")
fi
args+=(--spec "$SPEC_URL" --replace)

exec restish "${args[@]}"
