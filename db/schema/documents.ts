import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { category, space } from './spaces'

export const documentStatusEnum = pgEnum('document_status', ['draft', 'published'])

export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    lastEditorId: text('last_editor_id').references(() => user.id, { onDelete: 'set null' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => space.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => category.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    contentJson: jsonb('content_json').notNull(),
    excerpt: text('excerpt'),
    status: documentStatusEnum('status').notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugSpaceIdx: uniqueIndex('document_slug_space_idx').on(table.spaceId, table.slug),
    statusPublishedIdx: index('document_status_published_idx').on(table.status, table.publishedAt),
    authorStatusIdx: index('document_author_status_idx').on(
      table.authorId,
      table.status,
      table.publishedAt,
    ),
    spaceStatusIdx: index('document_space_status_idx').on(
      table.spaceId,
      table.status,
      table.updatedAt,
    ),
    categoryStatusIdx: index('document_category_status_idx').on(
      table.categoryId,
      table.status,
      table.updatedAt,
    ),
  }),
)

export type DbDocument = typeof document.$inferSelect
export type NewDbDocument = typeof document.$inferInsert
