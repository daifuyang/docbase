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
  const [row] = await db
    .insert(schema.space)
    .values({
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
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
  const [row] = await db
    .insert(schema.category)
    .values({
      spaceId: input.spaceId,
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
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
