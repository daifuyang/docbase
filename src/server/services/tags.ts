import { asc } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { db } from '~/lib/db.server'
import type { Tag } from '~/shared/types'
import type { ServiceContext } from './context'

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