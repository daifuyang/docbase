DO $$
BEGIN
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS "drizzle"';
  EXECUTE 'GRANT USAGE, CREATE ON SCHEMA "drizzle" TO docbase_app';
END
$$;

SELECT 'schema=' || nspname || ' owner=' || pg_catalog.pg_get_userbyid(nspowner) AS info
FROM pg_namespace
WHERE nspname = 'drizzle';

SELECT 'app_usage=' || has_schema_privilege('docbase_app', 'drizzle', 'USAGE') ||
       ' app_create=' || has_schema_privilege('docbase_app', 'drizzle', 'CREATE') AS privs;
