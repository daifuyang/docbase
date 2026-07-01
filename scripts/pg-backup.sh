#!/usr/bin/env bash
# =============================================================================
# DocBase — PG 备份脚本（每天 02:00 on runner）
# 落本地 /backup/docbase/$(date +%F).dump，再 push 到 OSS。
# =============================================================================
set -euo pipefail

: "${APP_DB_URL:?must be set (docbase_app on private PG)}"
: "${OSS_BACKUP_BUCKET:?must be set (e.g. oss://docbase-backups-cnsh/)}"

PG_URL="$APP_DB_URL"
DATE=$(date -u +%Y-%m-%d-%H%M%SZ)
LOCAL_TMP=$(mktemp -d)
LOCAL_F="$LOCAL_TMP/docbase-$DATE.dump"

mkdir -p /backup/docbase

echo "▶ pg_backup — dumping $PG_URL → $LOCAL_F"
PGPASSWORD="$(echo "$PG_URL" | sed -E 's#^postgres://[^:]+:([^@]+)@.*#\1#')" \
  pg_dump --format=custom --no-owner --no-acl --jobs=4 \
    --host "$(echo "$PG_URL" | sed -E 's#^postgres://[^@]+@([^:/]+).*#\1#')" \
    --port "$(echo "$PG_URL" | sed -E 's#^postgres://[^@]+@[^:]+:([0-9]+).*#\1#')" \
    --username "$(echo "$PG_URL" | sed -E 's#^postgres://([^:]+):.*#\1#')" \
    --dbname "$(echo "$PG_URL" | sed -E 's#^postgres://[^/]+/([^?]+).*#\1#')" \
    --file "$LOCAL_F"

echo "▶ uploading to OSS"
ossutil cp "$LOCAL_F" "$OSS_BACKUP_BUCKET/pg/docbase-$DATE.dump" --force

echo "▶ purging local backup older than 14 days"
find /backup/docbase -mtime +14 -name '*.dump' -delete

rm -rf "$LOCAL_TMP"
echo "✓ pg_backup done"
