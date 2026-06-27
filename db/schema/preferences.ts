import { jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const userPreference = pgTable(
  'user_preference',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    valueJson: jsonb('value_json').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.key] }),
  }),
)

export type DbUserPreference = typeof userPreference.$inferSelect
export type NewDbUserPreference = typeof userPreference.$inferInsert
