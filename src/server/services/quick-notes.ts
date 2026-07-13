import type { JSONContent } from '@tiptap/core'
import { desc, eq } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'
import { rateLimit } from '~/lib/rate-limit.server'
import { slugify, withSuffix } from '~/lib/slug.server'
import type { TipTapDoc } from '~/shared/types'
import type { ServiceContext } from './context'
import { normalizeDocumentContent, readDocumentDetailBySlugService } from './documents'

const MAX_CONTENT_LEN = 4000
const LIST_DEFAULT_LIMIT = 50
const LIST_MAX_LIMIT = 200

export type QuickNote = {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

export type QuickNoteList = {
  items: QuickNote[]
  total: number
}

// =============================================================================
// Public service functions
// =============================================================================

export async function createQuickNoteService(
  ctx: ServiceContext,
  input: { content: string },
): Promise<QuickNote> {
  const rl = await rateLimit('quickNotes:create', ctx.userId, 60, 60)
  if (!rl.allowed) throw Errors.rateLimited(rl.resetAt)
  const content = normaliseContent(input.content)
  if (content === '') throw Errors.validation('小记内容不能为空')

  const [row] = await db
    .insert(schema.quickNote)
    .values({ authorId: ctx.userId, content })
    .returning()
  if (!row) throw Errors.internal('小记保存失败')
  return rowToQuickNote(row)
}

export async function listQuickNotesService(
  ctx: ServiceContext,
  input: { limit?: number },
): Promise<QuickNoteList> {
  const limit = clampLimit(input.limit)
  const rows = await db
    .select()
    .from(schema.quickNote)
    .where(eq(schema.quickNote.authorId, ctx.userId))
    .orderBy(desc(schema.quickNote.createdAt))
    .limit(limit)
  // Total is cheap to compute alongside the small N we limit to; the
  // service is author-scoped so the planner hits the (author_id, created_at)
  // index without a full scan.
  const total = await countByAuthor(ctx.userId)
  return {
    items: rows.map(rowToQuickNote),
    total,
  }
}

export async function deleteQuickNoteService(
  ctx: ServiceContext,
  input: { id: string },
): Promise<void> {
  const deleted = await db
    .delete(schema.quickNote)
    .where(eq(schema.quickNote.id, input.id))
    .returning({ id: schema.quickNote.id, authorId: schema.quickNote.authorId })
  const row = deleted[0]
  if (!row) throw Errors.notFound('小记不存在')
  if (row.authorId !== ctx.userId) throw Errors.forbidden('无权操作该小记')
}

/**
 * Convert a quick note into a fresh draft Document.
 * Returns the slug of the newly created document; the caller redirects the
 * user into DocumentForm to fill in title / space / category / tags.
 */
export async function promoteQuickNoteService(
  ctx: ServiceContext,
  input: { id: string },
): Promise<{
  document: { slug: string; title: string; contentJson: TipTapDoc; id: string }
  noteId: string
}> {
  const [row] = await db.select().from(schema.quickNote).where(eq(schema.quickNote.id, input.id))
  if (!row) throw Errors.notFound('小记不存在')
  if (row.authorId !== ctx.userId) throw Errors.forbidden('无权操作该小记')

  const content = row.content.trim()
  if (content === '') throw Errors.validation('空小记无法升格')

  const title = deriveTitle(content)
  const contentJson = noteToTipTapDoc(content, title)
  const baseSlug = slugify(title)
  let finalSlug = baseSlug
  for (let suffix = 2; ; suffix++) {
    const existing = await db.query.document.findFirst({
      where: eq(schema.document.slug, finalSlug),
    })
    if (!existing) break
    finalSlug = withSuffix(baseSlug, suffix)
  }

  // The promoted note lands as a draft in the user's first space; the form
  // will let them change space / category / title before publish. We pick
  // the first available space as a sensible default — admin can curate
  // spaces later.
  const firstSpace = await db.query.space.findFirst({ orderBy: schema.space.sortOrder })
  if (!firstSpace) throw Errors.validation('请先创建至少一个空间再升格小记')

  const [created] = await db
    .insert(schema.document)
    .values({
      authorId: ctx.userId,
      lastEditorId: ctx.userId,
      spaceId: firstSpace.id,
      categoryId: null,
      title,
      slug: finalSlug,
      contentJson: normalizeDocumentContent(title, contentJson),
      excerpt: content.slice(0, 280),
      status: 'draft',
    })
    .returning()
  if (!created) throw Errors.internal('升格失败')

  // After successful promote, drop the source note — promoting is a one-way
  // move, not a copy. The user still has the content inside the new draft.
  await db.delete(schema.quickNote).where(eq(schema.quickNote.id, input.id))

  const detail = await readDocumentDetailBySlugService(ctx, { slug: finalSlug })
  if (!detail) throw Errors.internal('升格成功但读取失败')

  return {
    document: {
      slug: detail.slug,
      title: detail.title,
      contentJson,
      id: detail.id,
    },
    noteId: input.id,
  }
}

// =============================================================================
// Helpers
// =============================================================================

function normaliseContent(input: string): string {
  if (typeof input !== 'string') throw Errors.validation('内容必须是文本')
  return input.replace(/\r\n/g, '\n').trim().slice(0, MAX_CONTENT_LEN)
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value ?? 0)) return LIST_DEFAULT_LIMIT
  return Math.max(1, Math.min(LIST_MAX_LIMIT, Math.floor(value as number)))
}

async function countByAuthor(authorId: string): Promise<number> {
  const rows = await db
    .select({ id: schema.quickNote.id })
    .from(schema.quickNote)
    .where(eq(schema.quickNote.authorId, authorId))
  return rows.length
}

function rowToQuickNote(row: typeof schema.quickNote.$inferSelect): QuickNote {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function deriveTitle(content: string): string {
  const firstLine = content.split('\n', 1)[0]?.trim() ?? ''
  if (firstLine) return firstLine.slice(0, 50)
  return content.slice(0, 50)
}

// Convert a plain-text quick note into a TipTap doc. We split on blank
// lines so multi-paragraph thoughts render as separate <p> nodes; lines
// inside a paragraph become hard breaks to preserve the original line
// breaks the author typed.
function noteToTipTapDoc(content: string, title: string): TipTapDoc {
  const paragraphs: JSONContent[] = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      if (lines.length === 1) {
        return { type: 'paragraph' as const, content: [{ type: 'text' as const, text: lines[0] }] }
      }
      const inlineContent: JSONContent[] = []
      lines.forEach((line, index) => {
        if (index > 0) inlineContent.push({ type: 'hardBreak' })
        if (line) inlineContent.push({ type: 'text', text: line })
      })
      return { type: 'paragraph', content: inlineContent }
    })

  if (paragraphs.length === 0) {
    paragraphs.push({
      type: 'paragraph',
      content: [{ type: 'text', text: title }],
    })
  }

  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: title }] },
      ...paragraphs,
    ],
  }
}
