import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import { deleteCategoryService, updateCategoryService } from '~/server/services/spaces'

const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    description: z.string().max(200).optional(),
    spaceId: z.string().uuid().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少需要提供一个可更新字段',
  })

export const Route = createFileRoute('/api/v1/categories/$id')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = z.string().uuid().parse(params.id)
          const input = updateCategorySchema.parse(await parseJson(request))
          const result = await updateCategoryService(ctx, { id, ...input })
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = z.string().uuid().parse(params.id)
          return json(await deleteCategoryService(ctx, { id }))
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
