-- =============================================================================
-- DocBase — PostgreSQL 最小权限授权脚本
-- 在 ECS 上由 PG superuser 执行一次，建立 docbase_app 账号。
-- 脚本幂等：重跑不会破坏现有的 docbase_app。
--
-- 设计原则：
--   1. 一个项目一个账号（docbase_app 专用，不与其它项目共用）；
--   2. 只能 CONNECT 到 docbase 库；
--   3. 在 public schema 上有 SELECT/INSERT/UPDATE/DELETE，
--      没有 DDL（CREATE/DROP/ALTER）、没有 SUPERUSER；
--   4. 默认权限：以后任何 CREATE TABLE 默认也能被 docbase_app 读写。
-- =============================================================================

-- (1) 创建角色（如果不存在）。密码从外部通过 psql 变量 :'APP_PWD' 注入。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'docbase_app') THEN
    EXECUTE format(
      'CREATE ROLE docbase_app LOGIN PASSWORD %L',
      current_setting('app.pwd', true)
    );
  END IF;
END $$;

-- (2) 收回 PUBLIC 上的全能权限
REVOKE ALL ON DATABASE docbase FROM PUBLIC;

-- (3) 给 docbase_app 最小权限
GRANT CONNECT ON DATABASE docbase TO docbase_app;
GRANT USAGE  ON SCHEMA public TO docbase_app;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES    IN SCHEMA public TO docbase_app;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO docbase_app;

-- (4) 以后任何 superuser CREATE 的新表，默认就能被 docbase_app 读写
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO docbase_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO docbase_app;

-- (5) 显式拒绝：docbase_app 不能破坏 schema
REVOKE CREATE ON SCHEMA public FROM docbase_app;
