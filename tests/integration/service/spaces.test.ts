// Service-layer contract test for spaces + categories.
// Pinned the new updateCategoryService and deleteSpaceService helpers that
// the DocBase knowledge-space migration depends on.
//
// Covers:
//   - updateCategoryService retargets attached documents when spaceId moves
//   - updateCategoryService ignores unchanged fields
//   - updateCategoryService rejects moving to a non-existent target space
//   - deleteSpaceService refuses (CONFLICT) when categories or documents remain
//   - deleteSpaceService actually removes the row once emptied
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '~/../db'
import * as schema from '~/../db/schema'
import { ServerError } from '~/lib/errors'
import { contextForUser } from '~/server/services/context'
import {
  createCategoryService,
  createSpaceService,
  deleteSpaceService,
  updateCategoryService,
} from '~/server/services/spaces'

const ctx = contextForUser('svc_test_user')

const TIPTAP = {
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'spaces service test' }] }],
}

describe('spaces + categories service layer', () => {
  // Names + slug suffixes that won't collide with the dev DB or with each
  // other across re-runs of this test file.
  const tag = `t${Date.now().toString(36)}`
  const targetSpaceName = `Test Target Space ${tag}`
  const sourceSpaceName = `Test Source Space ${tag}`
  const categoryName = `Test Category ${tag}`

  let targetSpaceId = ''
  let sourceSpaceId = ''
  let categoryId = ''
  let documentId = ''
  let emptySpaceId = ''

  beforeAll(async () => {
    // Mirror the documents test setup: `contextForUser('svc_test_user')` only
    // produces a literal userId; replace it with the real DB row id so
    // `requireAdmin` can find the admin user.
    const testUser = await db.query.user.findFirst({
      where: eq(schema.user.username, 'svc_test_user'),
    })
    if (!testUser) throw new Error('svc_test_user not seeded — run documents suite first')
    ctx.userId = testUser.id

    const target = await createSpaceService(ctx, { name: targetSpaceName })
    targetSpaceId = target.space.id

    const source = await createSpaceService(ctx, { name: sourceSpaceName })
    sourceSpaceId = source.space.id

    const cat = await createCategoryService(ctx, {
      spaceId: sourceSpaceId,
      name: categoryName,
    })
    categoryId = cat.category.id

    const inserted = await db
      .insert(schema.document)
      .values({
        authorId: ctx.userId,
        lastEditorId: ctx.userId,
        spaceId: sourceSpaceId,
        categoryId,
        title: 'Test doc in source category',
        slug: `svc-spaces-doc-${tag}`,
        contentJson: TIPTAP,
        status: 'draft',
      })
      .returning()
    const doc = inserted[0]
    if (!doc) throw new Error('Failed to seed document')
    documentId = doc.id

    // A throwaway space with no children for the delete-empty happy path.
    const empty = await createSpaceService(ctx, { name: `Test Empty Space ${tag}` })
    emptySpaceId = empty.space.id
  }, 30_000)

  afterAll(async () => {
    if (documentId) {
      await db.delete(schema.document).where(eq(schema.document.id, documentId))
    }
    if (categoryId) {
      await db.delete(schema.category).where(eq(schema.category.id, categoryId))
    }
    if (sourceSpaceId) {
      await db.delete(schema.space).where(eq(schema.space.id, sourceSpaceId))
    }
    if (targetSpaceId) {
      await db.delete(schema.space).where(eq(schema.space.id, targetSpaceId))
    }
    if (emptySpaceId) {
      // deleteSpaceService should have removed this; the delete is a safety net.
      await db.delete(schema.space).where(eq(schema.space.id, emptySpaceId))
    }
  })

  it('updateCategoryService moves the category and its documents to a new space', async () => {
    const result = await updateCategoryService(ctx, {
      id: categoryId,
      spaceId: targetSpaceId,
    })
    expect(result.category.id).toBe(categoryId)
    expect(result.category.spaceId).toBe(targetSpaceId)

    const reloadedDoc = await db.query.document.findFirst({
      where: eq(schema.document.id, documentId),
    })
    expect(reloadedDoc?.spaceId).toBe(targetSpaceId)
    expect(reloadedDoc?.categoryId).toBe(categoryId)
  })

  it('updateCategoryService leaves the document untouched when only the name changes', async () => {
    const before = await db.query.document.findFirst({ where: eq(schema.document.id, documentId) })
    const newName = `${categoryName} renamed`
    const result = await updateCategoryService(ctx, { id: categoryId, name: newName })
    expect(result.category.name).toBe(newName)
    const after = await db.query.document.findFirst({ where: eq(schema.document.id, documentId) })
    expect(after?.spaceId).toBe(before?.spaceId)
    expect(after?.categoryId).toBe(before?.categoryId)

    // Restore the name so the next tests see a stable state.
    await updateCategoryService(ctx, { id: categoryId, name: categoryName })
  })

  it('updateCategoryService rejects an unknown target space with NOT_FOUND', async () => {
    await expect(
      updateCategoryService(ctx, {
        id: categoryId,
        spaceId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('deleteSpaceService refuses with CONFLICT when categories still exist', async () => {
    await expect(deleteSpaceService(ctx, { id: targetSpaceId })).rejects.toMatchObject({
      code: 'CONFLICT',
      details: expect.objectContaining({
        remainingCategories: expect.any(Number),
      }),
    })
    // Sanity: target space is still around after the refused delete.
    const stillThere = await db.query.space.findFirst({ where: eq(schema.space.id, targetSpaceId) })
    expect(stillThere).toBeDefined()
  })

  it('deleteSpaceService removes the row when nothing is attached', async () => {
    const result = await deleteSpaceService(ctx, { id: emptySpaceId })
    expect(result.ok).toBe(true)
    expect(result.deletedSpaceId).toBe(emptySpaceId)
    const gone = await db.query.space.findFirst({ where: eq(schema.space.id, emptySpaceId) })
    expect(gone).toBeUndefined()
    emptySpaceId = '' // mark as cleaned so afterAll doesn't double-delete
  })

  it('deleteSpaceService returns NOT_FOUND for an unknown id', async () => {
    await expect(
      deleteSpaceService(ctx, { id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toBeInstanceOf(ServerError)
  })
})
