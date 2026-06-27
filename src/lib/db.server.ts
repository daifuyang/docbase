// Re-export the Drizzle DB instance for server modules
// (placed here so all `~/lib/db.server` imports route through one source)
export { db, schema } from '~/../db'
export type { Database } from '~/../db'
