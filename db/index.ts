import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://docbase:docbase@localhost:5432/docbase'

// postgres.js client with reasonable pool defaults for self-hosted
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: true,
})

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' })
export type Database = typeof db
export { schema }
