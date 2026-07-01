#!/usr/bin/env bash
# =============================================================================
# DocBase — Redis ACL 应用脚本
# 用 ECS Redis admin 账号连到 Redis，运行 ACL load，把 ACL 文件落到内存。
#
# 使用方式：
#   env REDIS_ADMIN_PWD=xxx ECS_REDIS_HOST=10.0.x.x ECS_REDIS_PORT=6379 \
#       REDIS_APP_PWD=<docbase_app 密码> bash scripts/apply-redis-acl.sh
#
# 步骤：
#   (1) 用 admin 账号连，确认 AUTH 通过
#   (2) 用 ACL SETUSER 覆盖 docbase_app 的密码与 keyspace
#   (3) ACL SAVE 把当前内存里的 ACL 落盘到 /path/to/acl.conf
#   (4) 退出 default user
# =============================================================================
set -euo pipefail

: "${REDIS_ADMIN_PWD:?must be set (e.g. the default user password before we disable it)}"
: "${ECS_REDIS_HOST:?must be set}"
: "${ECS_REDIS_PORT:=6379}"
: "${REDIS_APP_PWD:?must be set (new docbase_app password)}"

REDIS_CLI=(redis-cli -h "$ECS_REDIS_HOST" -p "$ECS_REDIS_PORT" -a "$REDIS_ADMIN_PWD" --no-auth-warning)

echo "[apply-redis-acl] connecting to ${ECS_REDIS_HOST}:${ECS_REDIS_PORT}"
"${REDIS_CLI[@]}" ping | grep -q PONG

echo "[apply-redis-acl] recreating docbase_app with keyspace ~docbase:*"
"${REDIS_CLI[@]}" ACL SETUSER docbase_app \
  on ">$REDIS_APP_PWD" "~docbase:*" \
  "+@read" "+@write" "+@connection" "+@keyspace" \
  "+@string" "+@hash" "+@list" "+@set" "+@sortedset" \
  "+@bitmap" "+@hyperloglog" "+@geo" "+@stream" "+@pubsub" \
  "+@scripting" "+del" "+expire" "+incr" "+ttl" "+set" \
  "+get" "+mget" "+mset" "+exists" "+scan" "+type" \
  "+pfadd" "+pfcount" "+zadd" "+zrange" "+zrangebyscore" "+zrem" \
  "-@dangerous" "-@admin" "-flushall" "-flushdb" "-config" "-debug" \
  "-shutdown" "-replicaof" "-failover" "-cluster" "-keys" "-migrate" \
  "-restore" "-object" "-wait" "-client" "-latency" "-memory" \
  "-lolwut" "-reset" "resetchannels" "resetchannels"

echo "[apply-redis-acl] disabling default user"
"${REDIS_CLI[@]}" ACL SETUSER default off >/dev/null

echo "[apply-redis-acl] saving to disk (writes /path/to/acl.conf on the server)"
"${REDIS_CLI[@]}" ACL SAVE

echo "[apply-redis-acl] verifying docbase_app can auth & keyspace is restricted"
if ! redis-cli -h "$ECS_REDIS_HOST" -p "$ECS_REDIS_PORT" \
    --user docbase_app --pass "$REDIS_APP_PWD" ACL WHOAMI | grep -q docbase_app; then
  echo "[apply-redis-acl] FAIL: docbase_app cannot authenticate" >&2
  exit 1
fi

# ACL whoami should be docbase_app
ALLOWED=$(redis-cli -h "$ECS_REDIS_HOST" -p "$ECS_REDIS_PORT" \
  --user docbase_app --pass "$REDIS_APP_PWD" \
  --no-auth-warning ACL WHOAMI)
echo "[apply-redis-acl] WHOAMI = $ALLOWED"

# Try to set a disallowed key — expect failure
echo "[apply-redis-acl] testing keyspace boundary:"
if redis-cli -h "$ECS_REDIS_HOST" -p "$ECS_REDIS_PORT" \
    --user docbase_app --pass "$REDIS_APP_PWD" \
    --no-auth-warning SET tmp:probe on 2>&1 | grep -qi "no permission\|no key access"; then
  echo "[apply-redis-acl] OK: docbase_app cannot touch tmp:*"
else
  echo "[apply-redis-acl] WARN: docbase_app could touch tmp:probe — check ACL!"
  exit 1
fi

# Try safe key — expect success
redis-cli -h "$ECS_REDIS_HOST" -p "$ECS_REDIS_PORT" \
    --user docbase_app --pass "$REDIS_APP_PWD" \
    --no-auth-warning SET docbase:probe ok EX 10 >/dev/null
echo "[apply-redis-acl] OK: docbase_app can write docbase:* keys"

echo "[apply-redis-acl] done"
