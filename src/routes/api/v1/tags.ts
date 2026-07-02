import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, requireApiContext } from '~/server/http'
import { listTagsService } from '~/server/services/tags'

const listTagsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

export const Route = createFileRoute('/api/v1/tags')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const url = new URL(request.url)
          const query = listTagsQuerySchema.parse(Object.fromEntries(url.searchParams))
          return json(await listTagsService(ctx, query))
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
