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
//   - createSpaceService with parentId nests the new space
//   - updateSpaceService re-parents a space and rejects cycles
//   - deleteSpaceService refuses when the space still has children
//   - listSpaceTreeService returns a recursive children tree (any depth)
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '~/../db'
import * as schema from '~/../db/schema'
import { ServerError } from '~/lib/errors'
import { contextForUser } from '~/server/services/context'
import {
  createCategoryService,
  createSpaceService,
  deleteCategoryService,
  deleteSpaceService,
  listSpaceTreeService,
  updateCategoryService,
  updateSpaceService,
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
  const emptyCategoryName = `Test Empty Category ${tag}`
  const parentSpaceName = `Test Parent Space ${tag}`
  const childSpaceName = `Test Child Space ${tag}`
  const grandchildSpaceName = `Test Grandchild Space ${tag}`

  let targetSpaceId = ''
  let sourceSpaceId = ''
  let categoryId = ''
  let emptyCategoryId = ''
  let documentId = ''
  let emptySpaceId = ''
  let parentSpaceId = ''
  let childSpaceId = ''
  let grandchildSpaceId = ''

  beforeAll(async () => {
    // Self-seed the admin user the same way documents.test.ts does. Without
    // this, running this suite alone (or before documents.test.ts) on a fresh
    // CI database would fail because `svc_test_user` does not exist yet.
    const existing = await db.query.user.findFirst({
      where: eq(schema.user.username, 'svc_test_user'),
    })
    if (existing) {
      ctx.userId = existing.id
    } else {
      const newId = `test-user-${Date.now()}`
      const inserted = await db
        .insert(schema.user)
        .values({
          id: newId,
          username: 'svc_test_user',
          email: 'svc@test.local',
          displayName: 'Test User',
          name: 'Test User',
          role: 'admin',
        })
        .returning()
      const seeded = inserted[0]
      if (!seeded) throw new Error('Failed to seed svc_test_user')
      ctx.userId = seeded.id
    }

    const target = await createSpaceService(ctx, { name: targetSpaceName })
    targetSpaceId = target.space.id

    const source = await createSpaceService(ctx, { name: sourceSpaceName })
    sourceSpaceId = source.space.id

    const cat = await createCategoryService(ctx, {
      spaceId: sourceSpaceId,
      name: categoryName,
    })
    categoryId = cat.category.id
    const emptyCategory = await createCategoryService(ctx, {
      spaceId: sourceSpaceId,
      name: emptyCategoryName,
    })
    emptyCategoryId = emptyCategory.category.id

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

    // Three-level nesting for the parent/child/grandchild cycle tests.
    const parent = await createSpaceService(ctx, { name: parentSpaceName })
    parentSpaceId = parent.space.id
    const child = await createSpaceService(ctx, {
      name: childSpaceName,
      parentId: parentSpaceId,
    })
    childSpaceId = child.space.id
    const grandchild = await createSpaceService(ctx, {
      name: grandchildSpaceName,
      parentId: childSpaceId,
    })
    grandchildSpaceId = grandchild.space.id
  }, 30_000)

  afterAll(async () => {
    if (documentId) {
      await db.delete(schema.document).where(eq(schema.document.id, documentId))
    }
    if (emptyCategoryId) {
      await db.delete(schema.category).where(eq(schema.category.id, emptyCategoryId))
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
    // Tear down the nesting in reverse so we don't trip the FK guards.
    if (grandchildSpaceId) {
      await db.delete(schema.space).where(eq(schema.space.id, grandchildSpaceId))
    }
    if (childSpaceId) {
      await db.delete(schema.space).where(eq(schema.space.id, childSpaceId))
    }
    if (parentSpaceId) {
      await db.delete(schema.space).where(eq(schema.space.id, parentSpaceId))
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

  it('deleteCategoryService removes an empty category', async () => {
    const result = await deleteCategoryService(ctx, { id: emptyCategoryId })
    expect(result).toEqual({ ok: true, deletedCategoryId: emptyCategoryId })
    const gone = await db.query.category.findFirst({
      where: eq(schema.category.id, emptyCategoryId),
    })
    expect(gone).toBeUndefined()
    emptyCategoryId = ''
  })

  it('deleteCategoryService refuses with CONFLICT when documents still exist', async () => {
    await expect(deleteCategoryService(ctx, { id: categoryId })).rejects.toMatchObject({
      code: 'CONFLICT',
      details: expect.objectContaining({ remainingDocuments: expect.any(Number) }),
    })
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

  it('createSpaceService nests the new space under the given parentId', async () => {
    // The seeded `childSpace` already lives under parentSpace — verify the
    // reloaded row matches.
    const reloaded = await db.query.space.findFirst({
      where: eq(schema.space.id, childSpaceId),
    })
    expect(reloaded?.parentId).toBe(parentSpaceId)
  })

  it('updateSpaceService moves the space to top level when parentId is null', async () => {
    const result = await updateSpaceService(ctx, {
      id: childSpaceId,
      parentId: null,
    })
    expect(result.space.parentId).toBeNull()

    // Restore the nesting so later tests have a stable fixture.
    await updateSpaceService(ctx, {
      id: childSpaceId,
      parentId: parentSpaceId,
    })
  })

  it('updateSpaceService rejects a self-parent with VALIDATION_ERROR', async () => {
    await expect(
      updateSpaceService(ctx, { id: parentSpaceId, parentId: parentSpaceId }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('updateSpaceService rejects an unknown parent with NOT_FOUND', async () => {
    await expect(
      updateSpaceService(ctx, {
        id: parentSpaceId,
        parentId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('updateSpaceService rejects making the space a child of one of its descendants', async () => {
    // grandchild -> child -> parent. Promoting parent under grandchild would
    // form a cycle (parent becomes a descendant of itself).
    await expect(
      updateSpaceService(ctx, { id: parentSpaceId, parentId: grandchildSpaceId }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deleteSpaceService refuses with CONFLICT when child spaces exist', async () => {
    await expect(deleteSpaceService(ctx, { id: parentSpaceId })).rejects.toMatchObject({
      code: 'CONFLICT',
      details: expect.objectContaining({
        remainingChildren: expect.any(Number),
      }),
    })
    // Sanity: parent is still around after the refused delete.
    const stillThere = await db.query.space.findFirst({
      where: eq(schema.space.id, parentSpaceId),
    })
    expect(stillThere).toBeDefined()
  })

  it('listSpaceTreeService returns a recursive children tree at arbitrary depth', async () => {
    const tree = await listSpaceTreeService(ctx)
    const parent = tree.items.find((node) => node.id === parentSpaceId)
    expect(parent).toBeDefined()
    if (!parent) throw new Error('parent space missing from tree')
    // The parent is not a top-level item by itself in this fixture; it is a
    // child of one of the seeded group spaces (or a stray top-level item
    // depending on dev DB state). Either way the recursive invariant must
    // hold: walking the children chain reaches the grandchild, regardless of
    // how many levels of nesting sit between.
    function findNode(
      nodes: Array<{ id: string; children: Array<{ id: string; children: unknown[] }> }>,
      id: string,
    ): { id: string; children: Array<{ id: string; children: unknown[] }> } | undefined {
      for (const node of nodes) {
        if (node.id === id) return node
        const child = findNode(
          node.children as Array<{
            id: string
            children: Array<{ id: string; children: unknown[] }>
          }>,
          id,
        )
        if (child) return child
      }
      return undefined
    }
    const grandchildNode = findNode(tree.items as never, grandchildSpaceId)
    expect(grandchildNode).toBeDefined()
    // And it must be reachable via the child → grandchild chain so we know
    // the parent_id link was followed (not just present somewhere random).
    const childNode = findNode(tree.items as never, childSpaceId)
    expect(childNode).toBeDefined()
    const grandchildren = (childNode?.children as Array<{ id: string }>) ?? []
    expect(grandchildren.some((g) => g.id === grandchildSpaceId)).toBe(true)
  })
})
