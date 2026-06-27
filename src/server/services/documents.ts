import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'
import { rateLimit } from '~/lib/rate-limit.server'
import { redis } from '~/lib/redis.server'
import { slugify, withSuffix } from '~/lib/slug.server'
import { renderTiptapToHtml } from '~/lib/tiptap.server'
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
} from '~/shared/validation/document'
import { searchDocumentsSchema } from '~/shared/validation/document'
import type {
  DocumentDetail,
  DocumentSummary,
  PaginatedResponse,
} from '~/shared/types'
import type { ServiceContext } from './context'

// =============================================================================
// Public service functions (called by both Web server-fn shims and the CLI)
// =============================================================================

export async function listDocumentsService(
  _ctx: ServiceContext,
  rawInput: unknown,
): Promise<PaginatedResponse<DocumentSummary>> {
  const input = searchDocumentsSchema.parse(rawInput ?? {})
  return queryDocuments(input)
}

export const searchDocumentsService = listDocumentsService

export async function listMyDocumentsService(
  ctx: ServiceContext,
  rawInput: unknown,
): Promise<PaginatedResponse<DocumentSummary>> {
  const input = searchDocumentsSchema.parse(rawInput ?? {})
  return queryDocuments({ ...input, authorId: ctx.userId })
}

export async function getDocumentBySlugService(
  ctx: ServiceContext,
  input: { slug: string },
): Promise<DocumentDetail | null> {
  return readDocumentDetail(ctx, input.slug, /* incrementViews */ true)
}

/**
 * Internal re-read used by create/update so the post-write document object
 * doesn't accidentally bump the view counter.
 */
export async function readDocumentDetailBySlugService(
  ctx: ServiceContext,
  input: { slug: string },
): Promise<DocumentDetail | null> {
  return readDocumentDetail(ctx, input.slug, /* incrementViews */ false)
}

export async function createDocumentService(
  ctx: ServiceContext,
  input: CreateDocumentInput,
): Promise<{ document: DocumentDetail }> {
  const rl = await rateLimit('documents:create', ctx.userId, 10, 60)
  if (!rl.allowed) throw Errors.rateLimited(rl.resetAt)

  const baseSlug = slugify(input.title)
  let finalSlug = baseSlug
  for (let suffix = 2; ; suffix++) {
    const existing = await db.query.document.findFirst({
      where: and(eq(schema.document.spaceId, input.spaceId), eq(schema.document.slug, finalSlug)),
    })
    if (!existing) break
    finalSlug = withSuffix(baseSlug, suffix)
  }

  const [documentRow] = await db
    .insert(schema.document)
    .values({
      authorId: ctx.userId,
      lastEditorId: ctx.userId,
      spaceId: input.spaceId,
      categoryId: input.categoryId ?? null,
      title: input.title,
      slug: finalSlug,
      contentJson: input.contentJson,
      excerpt: extractExcerpt(input.contentJson),
      status: input.status,
      publishedAt: input.status === 'published' ? new Date() : null,
    })
    .returning()
  if (!documentRow) throw Errors.internal('文档创建失败')

  await replaceDocumentTags(documentRow.id, input.tags)
  await redis.del('documents:list:*').catch(() => {})

  const detail = await readDocumentDetailBySlugService(ctx, { slug: finalSlug })
  if (!detail) throw Errors.internal('文档创建成功但读取失败')
  return { document: detail }
}

export async function updateDocumentService(
  ctx: ServiceContext,
  input: UpdateDocumentInput,
): Promise<{ document: DocumentDetail }> {
  const existing = await db.query.document.findFirst({ where: eq(schema.document.id, input.id) })
  if (!existing) throw Errors.notFound('文档不存在')
  if (existing.authorId !== ctx.userId) throw Errors.forbidden('只能编辑自己创建的文档')

  await db
    .update(schema.document)
    .set({
      title: input.title ?? existing.title,
      contentJson: input.contentJson ?? existing.contentJson,
      excerpt: input.contentJson ? extractExcerpt(input.contentJson) : existing.excerpt,
      status: input.status ?? existing.status,
      spaceId: input.spaceId ?? existing.spaceId,
      categoryId: input.categoryId === undefined ? existing.categoryId : input.categoryId,
      lastEditorId: ctx.userId,
      publishedAt:
        input.status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.document.id, input.id))

  if (input.tags) await replaceDocumentTags(input.id, input.tags)
  await redis.del('documents:list:*').catch(() => {})

  const detail = await readDocumentDetailBySlugService(ctx, { slug: existing.slug })
  if (!detail) throw Errors.internal('更新后读取失败')
  return { document: detail }
}

export async function deleteDocumentService(
  ctx: ServiceContext,
  input: { id: string },
): Promise<{ ok: true }> {
  const existing = await db.query.document.findFirst({ where: eq(schema.document.id, input.id) })
  if (!existing) throw Errors.notFound('文档不存在')
  if (existing.authorId !== ctx.userId) throw Errors.forbidden('只能删除自己创建的文档')
  await db.delete(schema.document).where(eq(schema.document.id, input.id))
  await redis.del('documents:list:*').catch(() => {})
  return { ok: true }
}

/**
 * Resolve a document slug to its DB id (uuid).
 * Used by CLI commands that take a slug but need to call update/delete
 * (which operate on the uuid `id`).
 */
export async function getDocumentIdBySlugService(
  _ctx: ServiceContext,
  input: { slug: string },
): Promise<{ id: string; authorId: string; status: 'draft' | 'published' } | null> {
  const row = await db.query.document.findFirst({
    where: eq(schema.document.slug, input.slug),
    columns: { id: true, authorId: true, status: true },
  })
  return row ?? null
}

// =============================================================================
// Internal helpers (not exported via the service barrel)
// =============================================================================

async function readDocumentDetail(
  ctx: ServiceContext,
  slug: string,
  incrementViews: boolean,
): Promise<DocumentDetail | null> {
  const row = await db
    .select({
      document: schema.document,
      creator: schema.user,
      space: schema.space,
      category: schema.category,
    })
    .from(schema.document)
    .innerJoin(schema.user, eq(schema.document.authorId, schema.user.id))
    .innerJoin(schema.space, eq(schema.document.spaceId, schema.space.id))
    .leftJoin(schema.category, eq(schema.document.categoryId, schema.category.id))
    .where(eq(schema.document.slug, slug))
    .limit(1)
    .then((rows) => rows[0])

  if (!row) return null
  if (row.document.status === 'draft' && row.document.authorId !== ctx.userId) return null

  if (incrementViews) {
    void db
      .update(schema.document)
      .set({ viewCount: sql`${schema.document.viewCount} + 1` })
      .where(eq(schema.document.id, row.document.id))
      .catch(() => {})
  }

  return {
    ...(await toSummary(row)),
    contentHtml: renderTiptapToHtml(
      row.document.contentJson as Parameters<typeof renderTiptapToHtml>[0],
    ),
    contentJson: row.document.contentJson as DocumentDetail['contentJson'],
    status: row.document.status,
    isAuthor: row.document.authorId === ctx.userId,
  }
}

async function queryDocuments(input: {
  query?: string
  spaceSlug?: string
  categorySlug?: string
  tagSlug?: string
  authorId?: string
  status?: 'draft' | 'published'
  page?: number
  pageSize?: number
}): Promise<PaginatedResponse<DocumentSummary>> {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 20
  const conditions = [eq(schema.document.status, input.status ?? 'published')]

  if (input.authorId) conditions.push(eq(schema.document.authorId, input.authorId))
  if (input.query) {
    const pattern = `%${input.query}%`
    const searchCondition = or(
      ilike(schema.document.title, pattern),
      ilike(schema.document.excerpt, pattern),
      ilike(sql`${schema.document.contentJson}::text`, pattern),
    )
    if (searchCondition) conditions.push(searchCondition)
  }
  if (input.spaceSlug) {
    const row = await db.query.space.findFirst({ where: eq(schema.space.slug, input.spaceSlug) })
    if (!row) return { items: [], total: 0, page, pageSize }
    conditions.push(eq(schema.document.spaceId, row.id))
  }
  if (input.categorySlug) {
    const row = await db.query.category.findFirst({
      where: eq(schema.category.slug, input.categorySlug),
    })
    if (!row) return { items: [], total: 0, page, pageSize }
    conditions.push(eq(schema.document.categoryId, row.id))
  }
  if (input.tagSlug) {
    const row = await db.query.tag.findFirst({ where: eq(schema.tag.slug, input.tagSlug) })
    if (!row) return { items: [], total: 0, page, pageSize }
    const ids = await db
      .select({ id: schema.documentTag.documentId })
      .from(schema.documentTag)
      .where(eq(schema.documentTag.tagId, row.id))
    if (ids.length === 0) return { items: [], total: 0, page, pageSize }
    conditions.push(
      sql`${schema.document.id} IN (${sql.join(
        ids.map((r) => sql`${r.id}`),
        sql`, `,
      )})`,
    )
  }

  const rows = await db
    .select({
      document: schema.document,
      creator: schema.user,
      space: schema.space,
      category: schema.category,
    })
    .from(schema.document)
    .innerJoin(schema.user, eq(schema.document.authorId, schema.user.id))
    .innerJoin(schema.space, eq(schema.document.spaceId, schema.space.id))
    .leftJoin(schema.category, eq(schema.document.categoryId, schema.category.id))
    .where(and(...conditions))
    .orderBy(asc(schema.document.sortOrder), desc(schema.document.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.document)
    .where(and(...conditions))

  return {
    items: await Promise.all(rows.map(toSummary)),
    total: Number(countRow?.count ?? 0),
    page,
    pageSize,
  }
}

async function toSummary(row: {
  document: typeof schema.document.$inferSelect
  creator: typeof schema.user.$inferSelect
  space: typeof schema.space.$inferSelect
  category: typeof schema.category.$inferSelect | null
}): Promise<DocumentSummary> {
  const tags = await db
    .select({ name: schema.tag.name })
    .from(schema.documentTag)
    .innerJoin(schema.tag, eq(schema.documentTag.tagId, schema.tag.id))
    .where(eq(schema.documentTag.documentId, row.document.id))

  const creator = {
    id: row.creator.id,
    username: row.creator.username,
    displayName: row.creator.displayName,
  }

  return {
    id: row.document.id,
    title: row.document.title,
    slug: row.document.slug,
    excerpt: row.document.excerpt,
    creator,
    author: creator,
    space: {
      id: row.space.id,
      name: row.space.name,
      slug: row.space.slug,
      description: row.space.description,
    },
    category: row.category
      ? {
          id: row.category.id,
          spaceId: row.category.spaceId,
          name: row.category.name,
          slug: row.category.slug,
          description: row.category.description,
        }
      : null,
    publishedAt: row.document.publishedAt?.toISOString() ?? null,
    updatedAt: row.document.updatedAt.toISOString(),
    viewCount: row.document.viewCount,
    tags: tags.map((tag) => tag.name),
  }
}

async function replaceDocumentTags(documentId: string, names: string[]) {
  await db.delete(schema.documentTag).where(eq(schema.documentTag.documentId, documentId))
  for (const name of names) {
    const slug = slugify(name)
    // Look up by slug (unique, normalized) — name uniqueness doesn't help
    // when callers use mixed-case variants that collide on slug.
    let tagRow = await db.query.tag.findFirst({ where: eq(schema.tag.slug, slug) })
    if (!tagRow) {
      const [inserted] = await db
        .insert(schema.tag)
        .values({ name, slug })
        .onConflictDoNothing({ target: schema.tag.slug })
        .returning()
      // onConflictDoNothing returns no row on conflict — re-fetch.
      tagRow =
        inserted ??
        (await db.query.tag.findFirst({ where: eq(schema.tag.slug, slug) }))
      if (!tagRow) throw Errors.internal('标签创建失败')
    }
    await db
      .insert(schema.documentTag)
      .values({ documentId, tagId: tagRow.id })
      .onConflictDoNothing()
  }
}

function extractExcerpt(doc: unknown): string {
  // Walk the TipTap JSON tree and concatenate all text nodes. Avoids the
  // previous implementation's mistake of `JSON.stringify`-ing the whole
  // tree and regex-replacing brackets — that stored a corrupted half-JSON
  // half-text blob into the `excerpt` column.
  const texts: string[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: unknown; content?: unknown[] }
    if (typeof n.text === 'string') texts.push(n.text)
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(doc)
  return texts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 280)
}