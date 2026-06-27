import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { document } from './documents'

export const tag = pgTable('tag', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const documentTag = pgTable(
  'document_tag',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => document.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.documentId, table.tagId] }),
    tagIdx: index('document_tag_tag_idx').on(table.tagId),
  }),
)

export type DbTag = typeof tag.$inferSelect
export type DbDocumentTag = typeof documentTag.$inferSelect
