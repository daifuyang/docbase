import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import { createCategoryService, listCategoriesService } from '~/server/services/spaces'

const createCategorySchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
})

export const Route = createFileRoute('/api/v1/categories')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return json(await listCategoriesService(await requireApiContext(request)))
        } catch (error) {
          return handleApiError(error)
        }
      },
      POST: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const input = createCategorySchema.parse(await parseJson(request))
          return json(await createCategoryService(ctx, input), { status: 201 })
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
