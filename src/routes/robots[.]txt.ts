import { createFileRoute } from '@tanstack/react-router'

const BASE_URL = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${BASE_URL}/sitemap.xml\n`
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      },
    },
  },
})
