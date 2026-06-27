import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const space = pgTable(
  'space',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index('space_slug_idx').on(table.slug),
  }),
)

export const category = pgTable(
  'category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => space.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    spaceIdx: index('category_space_idx').on(table.spaceId),
    slugIdx: index('category_slug_idx').on(table.spaceId, table.slug),
  }),
)

export type DbSpace = typeof space.$inferSelect
export type NewDbSpace = typeof space.$inferInsert
export type DbCategory = typeof category.$inferSelect
export type NewDbCategory = typeof category.$inferInsert
