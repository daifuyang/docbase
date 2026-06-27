#!/usr/bin/env bash
# Create a DocBase document from a Markdown file via the CLI.
#
# Usage:
#   ./create-from-file.sh <markdown-file> [--status draft|published] [--tags t1,t2]
#
# Exit codes match `docbase` itself (0 ok, 2 bad input, 4 auth, 5 forbidden, 6 rate limit).
# On success, prints the new slug and id to stdout.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <markdown-file> [--status draft|published] [--tags t1,t2]" >&2
  exit 2
fi

FILE="$1"
shift

if [[ ! -f "$FILE" ]]; then
  echo "error: file not found: $FILE" >&2
  exit 2
fi

# Always pass --json so downstream agents can pipe through jq.
exec pnpm exec docbase doc create --from "$FILE" --json "$@"