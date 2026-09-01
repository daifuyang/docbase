import { and, asc, desc, eq } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'
import { slugify } from '~/lib/slug.server'
import type { CategorySummary, SpaceSummary, SpaceTreeItem } from '~/shared/types'
import type { ServiceContext } from './context'
import { requireAdmin } from './context'

const NAV_EXPANDED_KEY = 'navigation.expanded'

export async function listSpacesService(_ctx: ServiceContext): Promise<{ items: SpaceSummary[] }> {
  const rows = await db.select().from(schema.space).orderBy(asc(schema.space.sortOrder))
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
    })),
  }
}

export async function listSpaceTreeService(
  _ctx: ServiceContext,
): Promise<{ items: SpaceTreeItem[] }> {
  const spaces = await db.select().from(schema.space).orderBy(asc(schema.space.sortOrder))
  const categories = await db.select().from(schema.category).orderBy(asc(schema.category.sortOrder))
  const documents = await db
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
    .orderBy(asc(schema.document.sortOrder), desc(schema.document.updatedAt))

  return {
    items: spaces.map((space) => ({
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      documents: documents
        .filter((document) => document.spaceId === space.id && !document.categoryId)
        .map((document) => ({
          id: document.id,
          title: document.title,
          slug: document.slug,
          status: document.status,
          updatedAt: document.updatedAt.toISOString(),
        })),
      categories: categories
        .filter((category) => category.spaceId === space.id)
        .map((category) => ({
          id: category.id,
          spaceId: category.spaceId,
          name: category.name,
          slug: category.slug,
          description: category.description,
          documents: documents
            .filter((document) => document.categoryId === category.id)
            .map((document) => ({
              id: document.id,
              title: document.title,
              slug: document.slug,
              status: document.status,
              updatedAt: document.updatedAt.toISOString(),
            })),
        })),
    })),
  }
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
  input: { name: string; description?: string },
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
      sortOrder: (lastSpace?.sortOrder ?? 0) + 10,
      createdBy: admin.id,
    })
    .returning()
  if (!row) throw Errors.internal('知识空间创建失败')

  return {
    space: { id: row.id, name: row.name, slug: row.slug, description: row.description },
  }
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

  const [categoryRows, documentRows] = await Promise.all([
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
  ])

  if (categoryRows.length > 0 || documentRows.length > 0) {
    throw Errors.conflict('该空间下仍有内容，请先迁移分类与文档', {
      remainingCategories: categoryRows.length,
      remainingDocuments: documentRows.length,
      sampleCategoryIds: categoryRows.map((c) => c.id),
      sampleDocumentIds: documentRows.map((d) => d.id),
    })
  }

  await db.delete(schema.space).where(eq(schema.space.id, input.id))

  return { ok: true, deletedSpaceId: input.id }
}
