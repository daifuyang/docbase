#!/usr/bin/env bash
# =============================================================================
# DocBase — PostgreSQL 最小权限授权脚本（一键执行）
# 用 PG superuser 连到 ECS 上的 docbase 库，运行 db/grant.sql。
#
# 使用方式：
#   env PG_ADMIN_PWD=xxx ECS_PG_HOST=10.0.x.x ECS_PG_PORT=5432 \
#       APP_DB_PWD=<docbase_app 密码> bash scripts/apply-grants.sh
#
# 所需凭证必须从 VPS runner 上的 env-config 读取，永不进仓库。
# =============================================================================
set -euo pipefail

: "${PG_ADMIN_PWD:?must be set (postgres superuser password)}"
: "${ECS_PG_HOST:?must be set (private RDS IP / ECS PG IP)}"
: "${ECS_PG_PORT:=5432}"
: "${APP_DB_PWD:?must be set (the docbase_app password to provision)}"

echo "[apply-grants] target = ${ECS_PG_HOST}:${ECS_PG_PORT}"

# (1) sanity: superuser 能连
PGPASSWORD="$PG_ADMIN_PWD" psql \
  -h "$ECS_PG_HOST" -p "$ECS_PG_PORT" -U postgres -d docbase \
  -v ON_ERROR_STOP=1 \
  -c 'select version();' >/dev/null

# (2) docbase 库不存在则创建
PGPASSWORD="$PG_ADMIN_PWD" psql \
  -h "$ECS_PG_HOST" -p "$ECS_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 \
  -tc "SELECT 1 FROM pg_database WHERE datname='docbase'" | grep -q 1 || \
PGPASSWORD="$PG_ADMIN_PWD" psql \
  -h "$ECS_PG_HOST" -p "$ECS_PG_PORT" -U postgres -d postgres \
  -c 'CREATE DATABASE docbase;'

# (3) 跑 grant.sql
PGPASSWORD="$PG_ADMIN_PWD" psql \
  -h "$ECS_PG_HOST" -p "$ECS_PG_PORT" -U postgres -d docbase \
  -v ON_ERROR_STOP=1 \
  -v "APP_PWD=${APP_DB_PWD}" \
  -f "$(dirname "$0")/../db/grant.sql"

echo "[apply-grants] OK: docbase_app provisioned"

# (4) 校验
PGPASSWORD="$APP_DB_PWD" psql \
  -h "$ECS_PG_HOST" -p "$ECS_PG_PORT" -U docbase_app -d docbase \
  -c 'select current_user, current_database();' \
  -c '\dn+' 2>/dev/null | head -20
