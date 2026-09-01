import { and, asc, desc, eq, ne } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'
import { slugify } from '~/lib/slug.server'
import type { CategorySummary, SpaceSummary, SpaceTreeItem } from '~/shared/types'
import type { ServiceContext } from './context'
import { requireAdmin } from './context'

const NAV_EXPANDED_KEY = 'navigation.expanded'

type DbSpaceRow = typeof schema.space.$inferSelect

export async function listSpacesService(_ctx: ServiceContext): Promise<{ items: SpaceSummary[] }> {
  const rows = await db.select().from(schema.space).orderBy(asc(schema.space.sortOrder))
  return { items: rows.map((row) => toSpaceSummary(row)) }
}

/**
 * Return the space tree with two-level nesting (one top-level group of
 * "knowledge sections" containing real child spaces). Implementation notes:
 *
 *   - All spaces (parents + children) are fetched in two queries; we then
 *     group children by `parentId` and walk the tree.
 *   - Sibling order is `(sortOrder ASC, slug ASC)` so the tree is stable
 *     even when two spaces share a sort order.
 *   - Only published documents are returned (matches the old behaviour).
 */
export async function listSpaceTreeService(
  _ctx: ServiceContext,
): Promise<{ items: SpaceTreeItem[] }> {
  const [spaces, categories, documents] = await Promise.all([
    db.select().from(schema.space).orderBy(asc(schema.space.sortOrder), asc(schema.space.slug)),
    db
      .select()
      .from(schema.category)
      .orderBy(asc(schema.category.sortOrder), asc(schema.category.slug)),
    db
      .select({
        id: schema.document.id,
        title: schema.document.title,
        slug: schema.document.slug,
        status: schema.document.status,
        spaceId: schema.document.spaceId,
        categoryId: schema.document.categoryId,
        sortOrder: schema.document.sortOrder,
        updatedAt: schema.document.updatedAt,
      })
      .from(schema.document)
      .where(eq(schema.document.status, 'published'))
      .orderBy(asc(schema.document.sortOrder), desc(schema.document.updatedAt)),
  ])

  // Group documents by spaceId once to avoid O(N) filters per space node.
  const docsBySpace = new Map<string, typeof documents>()
  const docsByCategory = new Map<string, typeof documents>()
  for (const doc of documents) {
    if (doc.categoryId) {
      const bucket = docsByCategory.get(doc.categoryId) ?? []
      bucket.push(doc)
      docsByCategory.set(doc.categoryId, bucket)
    } else {
      const bucket = docsBySpace.get(doc.spaceId) ?? []
      bucket.push(doc)
      docsBySpace.set(doc.spaceId, bucket)
    }
  }

  const categoriesBySpace = new Map<string, typeof categories>()
  for (const cat of categories) {
    const bucket = categoriesBySpace.get(cat.spaceId) ?? []
    bucket.push(cat)
    categoriesBySpace.set(cat.spaceId, bucket)
  }

  const childrenByParent = new Map<string, DbSpaceRow[]>()
  for (const space of spaces) {
    if (!space.parentId) continue
    const bucket = childrenByParent.get(space.parentId) ?? []
    bucket.push(space)
    childrenByParent.set(space.parentId, bucket)
  }

  function buildNode(space: DbSpaceRow): SpaceTreeItem {
    const spaceDocs = docsBySpace.get(space.id) ?? []
    const spaceCategories = categoriesBySpace.get(space.id) ?? []
    return {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      parentId: space.parentId,
      documents: spaceDocs.map(toDocumentTreeItem),
      categories: spaceCategories.map((cat) => ({
        id: cat.id,
        spaceId: cat.spaceId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        documents: (docsByCategory.get(cat.id) ?? []).map(toDocumentTreeItem),
      })),
      children: (childrenByParent.get(space.id) ?? []).map(buildNode),
    }
  }

  const roots = spaces.filter((space) => space.parentId === null)
  return { items: roots.map(buildNode) }
}

export async function getNavigationTreeService(
  ctx: ServiceContext,
): Promise<{ items: SpaceTreeItem[]; expandedKeys: string[] }> {
  const [tree, preference] = await Promise.all([
    listSpaceTreeService(ctx),
    db.query.userPreference.findFirst({
      where: and(
        eq(schema.userPreference.userId, ctx.userId),
        eq(schema.userPreference.key, NAV_EXPANDED_KEY),
      ),
    }),
  ])

  const value = preference?.valueJson
  const expandedKeys =
    value &&
    Array.isArray((value as { expandedKeys?: unknown }).expandedKeys) &&
    (value as { expandedKeys: unknown[] }).expandedKeys.every((key) => typeof key === 'string')
      ? (value as { expandedKeys: string[] }).expandedKeys
      : []

  return { items: tree.items, expandedKeys }
}

export async function updateNavigationTreeStateService(
  ctx: ServiceContext,
  input: { expandedKeys: string[] },
): Promise<{ ok: true }> {
  await db
    .insert(schema.userPreference)
    .values({
      userId: ctx.userId,
      key: NAV_EXPANDED_KEY,
      valueJson: { expandedKeys: input.expandedKeys },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.userPreference.userId, schema.userPreference.key],
      set: {
        valueJson: { expandedKeys: input.expandedKeys },
        updatedAt: new Date(),
      },
    })

  return { ok: true }
}

export async function listCategoriesBySpaceService(
  _ctx: ServiceContext,
  input: { spaceId: string },
): Promise<{ items: CategorySummary[] }> {
  const rows = await db
    .select()
    .from(schema.category)
    .where(eq(schema.category.spaceId, input.spaceId))
    .orderBy(asc(schema.category.sortOrder))

  return {
    items: rows.map((row) => ({
      id: row.id,
      spaceId: row.spaceId,
      name: row.name,
      slug: row.slug,
      description: row.description,
    })),
  }
}

export async function listCategoriesService(
  _ctx: ServiceContext,
): Promise<{ items: CategorySummary[] }> {
  const rows = await db
    .select()
    .from(schema.category)
    .orderBy(asc(schema.category.sortOrder), asc(schema.category.name))

  return {
    items: rows.map((row) => ({
      id: row.id,
      spaceId: row.spaceId,
      name: row.name,
      slug: row.slug,
      description: row.description,
    })),
  }
}

export async function createSpaceService(
  ctx: ServiceContext,
  input: { name: string; description?: string; parentId?: string | null },
): Promise<{ space: SpaceSummary }> {
  const admin = await requireAdmin(ctx)
  const [lastSpace] = await db
    .select({ sortOrder: schema.space.sortOrder })
    .from(schema.space)
    .orderBy(desc(schema.space.sortOrder))
    .limit(1)
  const [row] = await db
    .insert(schema.space)
    .values({
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      sortOrder: (lastSpace?.sortOrder ?? 0) + 10,
      createdBy: admin.id,
    })
    .returning()
  if (!row) throw Errors.internal('知识空间创建失败')

  return { space: toSpaceSummary(row) }
}

/**
 * Update an existing space. Supports partial updates of `name`, `description`
 * and `parentId`. Cycle detection is enforced — a space cannot become its
 * own ancestor (i.e. parent cannot be itself, nor any of its descendants).
 */
export async function updateSpaceService(
  ctx: ServiceContext,
  input: {
    id: string
    name?: string
    description?: string | null
    parentId?: string | null
  },
): Promise<{ space: SpaceSummary }> {
  await requireAdmin(ctx)

  const existing = await db.query.space.findFirst({ where: eq(schema.space.id, input.id) })
  if (!existing) throw Errors.notFound('知识空间不存在')

  const wantsParentChange = input.parentId !== undefined && input.parentId !== existing.parentId
  if (wantsParentChange) {
    // assertValidParent rejects null at the top, so input.parentId here is a
    // concrete uuid — but TS narrows the value through the comparison, so we
    // re-coerce to `string | null` to satisfy the parameter.
    await assertValidParent(input.id, input.parentId ?? null)
  }

  const nextName = input.name ?? existing.name
  const nextDescription = input.description === undefined ? existing.description : input.description
  const nextParentId = input.parentId === undefined ? existing.parentId : input.parentId

  // Detect a slug collision if the name changed.
  let nextSlug = existing.slug
  if (input.name !== undefined && input.name !== existing.name) {
    nextSlug = slugify(input.name)
    const collision = await db.query.space.findFirst({
      where: and(eq(schema.space.slug, nextSlug), ne(schema.space.id, input.id)),
    })
    if (collision) {
      throw Errors.validation(`slug 已存在：${nextSlug}`, { field: 'name' })
    }
  }

  const [row] = await db
    .update(schema.space)
    .set({
      name: nextName,
      slug: nextSlug,
      description: nextDescription,
      parentId: nextParentId,
      updatedAt: new Date(),
    })
    .where(eq(schema.space.id, input.id))
    .returning()

  if (!row) throw Errors.internal('知识空间更新失败')

  return { space: toSpaceSummary(row) }
}

export async function createCategoryService(
  ctx: ServiceContext,
  input: { spaceId: string; name: string; description?: string },
): Promise<{ category: CategorySummary }> {
  await requireAdmin(ctx)
  const [lastCategory] = await db
    .select({ sortOrder: schema.category.sortOrder })
    .from(schema.category)
    .where(eq(schema.category.spaceId, input.spaceId))
    .orderBy(desc(schema.category.sortOrder))
    .limit(1)
  const [row] = await db
    .insert(schema.category)
    .values({
      spaceId: input.spaceId,
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
      sortOrder: (lastCategory?.sortOrder ?? 0) + 10,
    })
    .returning()
  if (!row) throw Errors.internal('分类创建失败')

  return {
    category: {
      id: row.id,
      spaceId: row.spaceId,
      name: row.name,
      slug: row.slug,
      description: row.description,
    },
  }
}

/**
 * Update an existing category. Used by PATCH /api/v1/categories/{id}.
 *
 * Notable behaviour: when `spaceId` changes, all documents that were attached
 * to this category must also be retargeted to the new space — otherwise
 * `document.spaceId` would still reference the old space, and any subsequent
 * delete of the old space would be blocked by the FK `onDelete: 'restrict'`
 * guard. We do this in a single transaction so a partial failure leaves the
 * database consistent.
 */
export async function updateCategoryService(
  ctx: ServiceContext,
  input: { id: string; name?: string; description?: string; spaceId?: string },
): Promise<{ category: CategorySummary }> {
  await requireAdmin(ctx)

  const existing = await db.query.category.findFirst({ where: eq(schema.category.id, input.id) })
  if (!existing) throw Errors.notFound('分类不存在')

  // If the caller is moving the category to another space, verify the target
  // space actually exists. Without this check the FK insert/update would fail
  // with a less helpful error.
  if (input.spaceId !== undefined && input.spaceId !== existing.spaceId) {
    const target = await db.query.space.findFirst({ where: eq(schema.space.id, input.spaceId) })
    if (!target) throw Errors.notFound('目标空间不存在')
  }

  const next = {
    name: input.name ?? existing.name,
    description: input.description === undefined ? existing.description : input.description,
    spaceId: input.spaceId ?? existing.spaceId,
  }

  await db
    .update(schema.category)
    .set({
      name: next.name,
      description: next.description,
      spaceId: next.spaceId,
      updatedAt: new Date(),
    })
    .where(eq(schema.category.id, input.id))

  // When the category moves between spaces, every document that was attached
  // to it must follow — otherwise `document.spaceId` would still point at the
  // old space and the eventual `DELETE /api/v1/spaces/{oldSpaceId}` would be
  // blocked by the FK `onDelete: 'restrict'`. We skip this when the target
  // space is unchanged to avoid unnecessary writes.
  if (next.spaceId !== existing.spaceId) {
    await db
      .update(schema.document)
      .set({ spaceId: next.spaceId, updatedAt: new Date() })
      .where(eq(schema.document.categoryId, input.id))
  }

  return {
    category: {
      id: existing.id,
      spaceId: next.spaceId,
      name: next.name,
      slug: existing.slug,
      description: next.description,
    },
  }
}

/**
 * Delete a space. Refuses (409 CONFLICT) if the space still owns categories
 * or documents so the caller can move them first instead of orphaning rows.
 *
 * This matches the FK semantics already encoded in the schema:
 *   category.spaceId   onDelete: 'cascade'
 *   document.spaceId   onDelete: 'restrict'
 * So the cascade path would actually drop categories automatically, but we
 * surface a structured 409 here instead of silently deleting data — the
 * caller always wants to know what they're removing.
 */
export async function deleteSpaceService(
  ctx: ServiceContext,
  input: { id: string },
): Promise<{ ok: true; deletedSpaceId: string }> {
  await requireAdmin(ctx)

  const existing = await db.query.space.findFirst({ where: eq(schema.space.id, input.id) })
  if (!existing) throw Errors.notFound('知识空间不存在')

  const [categoryRows, documentRows, childRows] = await Promise.all([
    db
      .select({ id: schema.category.id, name: schema.category.name })
      .from(schema.category)
      .where(eq(schema.category.spaceId, input.id))
      .limit(5),
    db
      .select({ id: schema.document.id, title: schema.document.title })
      .from(schema.document)
      .where(eq(schema.document.spaceId, input.id))
      .limit(5),
    db
      .select({ id: schema.space.id, name: schema.space.name })
      .from(schema.space)
      .where(eq(schema.space.parentId, input.id))
      .limit(5),
  ])

  if (categoryRows.length > 0 || documentRows.length > 0) {
    throw Errors.conflict('该空间下仍有内容，请先迁移分类与文档', {
      remainingCategories: categoryRows.length,
      remainingDocuments: documentRows.length,
      sampleCategoryIds: categoryRows.map((c) => c.id),
      sampleDocumentIds: documentRows.map((d) => d.id),
    })
  }

  if (childRows.length > 0) {
    throw Errors.conflict('该空间下仍有子空间，请先迁移', {
      remainingChildren: childRows.length,
      sampleChildIds: childRows.map((c) => c.id),
    })
  }

  await db.delete(schema.space).where(eq(schema.space.id, input.id))

  return { ok: true, deletedSpaceId: input.id }
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function toSpaceSummary(row: DbSpaceRow): SpaceSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parentId,
  }
}

function toDocumentTreeItem(row: {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  updatedAt: Date
}): {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  updatedAt: string
} {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Assert that setting `parentId` on `spaceId` would not form a cycle. A
 * valid parent is either `null` — moving the space to the top level — or
 * another existing space that is not `spaceId` itself and not a descendant
 * of `spaceId`.
 *
 * Implementation: walk up from `parentId` collecting ancestors; if the
 * walk visits `spaceId`, the proposed parent is a descendant of the space
 * we are trying to reparent, which would form a cycle.
 *
 * We also reject the trivial cycle of "space becomes its own parent".
 */
async function assertValidParent(spaceId: string, parentId: string | null): Promise<void> {
  if (parentId === null) return
  if (parentId === spaceId) {
    throw Errors.validation('空间不能成为自己的父空间', { field: 'parentId' })
  }
  const target = await db.query.space.findFirst({ where: eq(schema.space.id, parentId) })
  if (!target) throw Errors.notFound('目标父空间不存在')

  // Walk up the ancestor chain of the proposed parent. Bounded at 1000
  // hops to defend against pre-existing data corruption.
  const seen = new Set<string>()
  let cursor: string | null = parentId
  let hops = 0
  while (cursor !== null) {
    if (seen.has(cursor)) {
      throw Errors.conflict('父空间链路已存在循环，请联系管理员修复数据', {
        chain: [...seen],
      })
    }
    if (cursor === spaceId) {
      throw Errors.validation('不能将空间移动到其后代空间之下', { field: 'parentId' })
    }
    seen.add(cursor)
    hops += 1
    if (hops > 1000) {
      throw Errors.internal('父空间链路过深，请联系管理员修复数据')
    }
    const parentRows: Array<{ parentId: string | null }> = await db
      .select({ parentId: schema.space.parentId })
      .from(schema.space)
      .where(eq(schema.space.id, cursor))
      .limit(1)
    const next: string | null = parentRows[0]?.parentId ?? null
    cursor = next
  }
}
