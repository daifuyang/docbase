import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { db } from '~/lib/db.server'

const BASE_URL = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const documents = await db
          .select({ slug: schema.document.slug, updatedAt: schema.document.updatedAt })
          .from(schema.document)
          .where(eq(schema.document.status, 'published'))
          .orderBy(desc(schema.document.updatedAt))
          .limit(5000)

        const tags = await db.select({ slug: schema.tag.slug }).from(schema.tag)

        const urls: Array<{ loc: string; lastmod?: string }> = [{ loc: `${BASE_URL}/` }]
        for (const document of documents) {
          urls.push({
            loc: `${BASE_URL}/documents/${document.slug}`,
            lastmod: document.updatedAt.toISOString(),
          })
        }
        for (const t of tags) {
          urls.push({ loc: `${BASE_URL}/tags/${t.slug}` })
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map(
            (u) =>
              `  <url>\n    <loc>${u.loc}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}  </url>`,
          )
          .join('\n')}\n</urlset>\n`

        return new Response(xml, {
          status: 200,
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        })
      },
    },
  },
})
