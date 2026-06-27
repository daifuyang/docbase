import { asc } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'
import { slugify } from '~/lib/slug.server'
import type { Tag } from '~/shared/types'
import type { ServiceContext } from './context'
import { requireAdmin } from './context'

export async function listTagsService(
  _ctx: ServiceContext,
  input?: { limit?: number },
): Promise<{ items: Tag[] }> {
  const limit = input?.limit ?? 100
  const rows = await db
    .select()
    .from(schema.tag)
    .orderBy(asc(schema.tag.name))
    .limit(limit)
  return {
    items: rows.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  }
}

export async function createTagService(
  ctx: ServiceContext,
  input: { name: string },
): Promise<{ tag: Tag }> {
  await requireAdmin(ctx)
  const name = input.name.trim()
  if (!name) throw Errors.validation('标签名不能为空')

  // Idempotent: if a tag with the same name or slug already exists, return it.
  const slug = slugify(name)
  const existing = await db.query.tag.findFirst({
    where: (t, { eq, or }) => or(eq(t.name, name), eq(t.slug, slug)),
  })
  if (existing) return { tag: { id: existing.id, name: existing.name, slug: existing.slug } }

  const [row] = await db.insert(schema.tag).values({ name, slug }).returning()
  if (!row) throw Errors.internal('标签创建失败')
  return { tag: { id: row.id, name: row.name, slug: row.slug } }
}