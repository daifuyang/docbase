// Service-layer contract test for documents.
// Guards against regressions after extracting the service layer.
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '~/../db'
import * as schema from '~/../db/schema'
import { contextForUser } from '~/server/services/context'
import {
  createDocumentService,
  deleteDocumentService,
  getDocumentBySlugService,
  listDocumentsService,
  updateDocumentService,
} from '~/server/services/documents'

const TIPTAP = {
  type: 'doc' as const,
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'service-layer test' }] },
  ],
}

const ctx = contextForUser('svc_test_user')

describe('documents service layer', () => {
  let spaceId: string
  let createdDocId: string

  beforeAll(async () => {
    // Use the seeded admin user so we have a real `user` row.
    const admin = await db.query.user.findFirst({ where: eq(schema.user.username, 'admin') })
    if (!admin) throw new Error('seed admin user missing — run `pnpm db:seed` first')
    ctx.userId = admin.id

    const space = await db.query.space.findFirst({
      where: eq(schema.space.name, '工程知识库'),
    })
    if (!space) throw new Error('seed space "工程知识库" missing — run `pnpm db:seed` first')
    spaceId = space.id
  })

  afterAll(async () => {
    if (createdDocId) {
      await db.delete(schema.document).where(eq(schema.document.id, createdDocId))
    }
  })

  it('createDocumentService inserts a document and returns the detail', async () => {
    const { document } = await createDocumentService(ctx, {
      title: 'Service layer test doc',
      contentJson: TIPTAP,
      tags: ['svc-test'],
      status: 'draft',
      spaceId,
    })
    createdDocId = document.id
    expect(document.title).toBe('Service layer test doc')
    expect(document.status).toBe('draft')
    expect(document.contentJson?.type).toBe('doc')
    expect(document.tags).toContain('svc-test')
  })

  it('getDocumentBySlugService reads it back and bumps viewCount by 1', async () => {
    const slug = 'service-layer-test-doc'
    const before = await db.query.document.findFirst({ where: eq(schema.document.slug, slug) })
    const detail = await getDocumentBySlugService(ctx, { slug })
    expect(detail).not.toBeNull()
    expect(detail?.slug).toBe(slug)
    // Wait a moment for the fire-and-forget viewCount update.
    await new Promise((r) => setTimeout(r, 50))
    const after = await db.query.document.findFirst({ where: eq(schema.document.slug, slug) })
    expect(Number(after?.viewCount)).toBe(Number(before?.viewCount ?? 0) + 1)
  })

  it('listDocumentsService returns paginated results', async () => {
    const page = await listDocumentsService(ctx, {})
    expect(Array.isArray(page.items)).toBe(true)
    expect(page.page).toBe(1)
  })

  it('updateDocumentService changes the title', async () => {
    const { document } = await updateDocumentService(ctx, {
      id: createdDocId,
      title: 'Service layer test doc (updated)',
    })
    expect(document.title).toBe('Service layer test doc (updated)')
  })

  it('updateDocumentService refuses non-author callers', async () => {
    const otherCtx = contextForUser('someone-else')
    await expect(
      updateDocumentService(otherCtx, { id: createdDocId, title: 'nope' }),
    ).rejects.toThrow()
  })

  it('deleteDocumentService removes the row', async () => {
    const result = await deleteDocumentService(ctx, { id: createdDocId })
    expect(result.ok).toBe(true)
    const row = await db.query.document.findFirst({ where: eq(schema.document.id, createdDocId) })
    expect(row).toBeUndefined()
    createdDocId = ''
  })
})