import postgres from 'postgres'

const superUrl = process.env.DOCBASE_PG_SUPER_URL
if (!superUrl) {
  console.error('DOCBASE_PG_SUPER_URL is required')
  process.exit(1)
}

const client = postgres(superUrl, { max: 1, prepare: false, connect_timeout: 5 })

try {
  await client.unsafe(`
    CREATE SCHEMA IF NOT EXISTS "drizzle";
    GRANT USAGE, CREATE ON SCHEMA "drizzle" TO docbase_app;
  `)

  const [schema] = await client`
    SELECT nspname, pg_catalog.pg_get_userbyid(nspowner) AS owner
    FROM pg_namespace
    WHERE nspname = 'drizzle'
  `
  const [privs] = await client`
    SELECT
      has_schema_privilege('docbase_app', 'drizzle', 'USAGE') AS app_usage,
      has_schema_privilege('docbase_app', 'drizzle', 'CREATE') AS app_create
  `

  console.log('schema:', JSON.stringify(schema ?? null))
  console.log('app_privs:', JSON.stringify(privs ?? null))
} catch (error) {
  console.error('ensure drizzle schema failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end({ timeout: 1 }).catch(() => undefined)
}
