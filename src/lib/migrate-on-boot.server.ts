import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { logger } from '~/lib/logger.server'
import { isFcDeployMode } from '~/lib/runtime-config.server'

// Boot-time DB migration hook.
//
// Why: the CI runner (GitHub Actions) sits on the public internet and
// cannot reach the production Postgres at its private VPC IP, so the
// `Apply DB migrations` workflow step fails after ~45s of TCP timeout.
// The FC runtime, by contrast, runs inside the same VPC and CAN reach the
// DB — so the safest place to apply pending migrations is the first
// invocation of the server bundle, before the HTTP listener starts.
//
// We only auto-migrate in FC mode + when `DOCBASE_INSTALLED=true`. The
// first-install flow already runs migrations through `migrateDatabase()`
// inside `runInstallService`, so this hook is a no-op on that path.
//
// Idempotency: the migrate() call is itself journal-based and a no-op
// when the schema is current. We also cache the in-flight Promise on
// globalThis so concurrent module-loads (HMR in dev, double-import in
// tests) only run migrate once per process.
const BOOT_MIGRATE_KEY = '__docbase_boot_migrate__'

type GlobalWithBootMigrate = typeof globalThis & {
  [BOOT_MIGRATE_KEY]?: Promise<void>
}

function runBootMigrate(): Promise<void> {
  if (!isFcDeployMode()) return Promise.resolve()
  if (process.env.DOCBASE_INSTALLED !== 'true') return Promise.resolve()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return Promise.resolve()

  const g = globalThis as GlobalWithBootMigrate
  if (g[BOOT_MIGRATE_KEY]) return g[BOOT_MIGRATE_KEY]

  const promise = (async () => {
    const client = postgres(databaseUrl, { max: 1, prepare: false })
    const db = drizzle(client)
    try {
      try {
        await migrate(db, { migrationsFolder: 'db/migrations' })
      } catch (error) {
        // Some FC environments grant the runtime role only DML (no DDL),
        // in which case the migrator must hand the schema diff to the
        // existing schema's owner instead. We retry with `migrationsSchema`
        // set, matching the fallback inside `migrateDatabase()` in the
        // install service. If the error isn't a permission error we
        // rethrow — that's a real failure the operator must see.
        const msg = error instanceof Error ? error.message : ''
        const causeMsg = error instanceof Error && error.cause ? (error.cause as Error).message : ''
        const isPermissionError = /permission denied|access denied|must be owner/i.test(
          msg + causeMsg,
        )
        if (!isPermissionError) throw error
        logger.warn(
          { event: 'boot-migrate-permission-retry' },
          'migrator lacks DDL on default schema; retrying with explicit migrationsSchema',
        )
        await migrate(db, {
          migrationsFolder: 'db/migrations',
          migrationsSchema: 'public',
        })
      }
      logger.info({ event: 'boot-migrate' }, 'database migrations applied at boot')
    } catch (error) {
      logger.error(
        { event: 'boot-migrate-failed', error: error instanceof Error ? error.message : error },
        'database migration failed at boot; refusing to start',
      )
      throw error
    } finally {
      await client.end({ timeout: 1 }).catch(() => undefined)
    }
  })()

  g[BOOT_MIGRATE_KEY] = promise
  return promise
}

// Eagerly kick off the migration so it runs as a side-effect of the
// server bundle being imported. The returned promise is exported for tests
// and for `beforeLoad` hooks that want to await readiness.
const bootMigratePromise = runBootMigrate()

if (bootMigratePromise && typeof bootMigratePromise.catch === 'function') {
  bootMigratePromise.catch(() => {
    // The error is already logged above. We swallow it here so an
    // unhandled rejection doesn't crash the process before Nitro's
    // startup handler can render a 500 page; the listener will still
    // come up and serve traffic (queries will then 500, which is the
    // correct UX for a half-broken deploy).
  })
}

export function ensureMigrationsApplied(): Promise<void> {
  return bootMigratePromise
}