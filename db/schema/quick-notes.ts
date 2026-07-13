import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'

// Quick notes — the YuQue-style "小记": private to the author, plain text,
// no title, no space/category. Promote-to-document pulls the content into
// DocumentForm as a starting paragraph.
export const quickNote = pgTable(
  'quick_note',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Plain text only (no TipTap JSON). 4000 chars is well over a typical
    // "flash thought" but still bounded to keep the JSON body sane.
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    authorCreatedIdx: index('quick_note_author_created_idx').on(table.authorId, table.createdAt),
  }),
)

export type QuickNoteRow = typeof quickNote.$inferSelect
export type QuickNoteInsert = typeof quickNote.$inferInsert
