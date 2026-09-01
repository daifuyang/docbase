import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, requireApiContext } from '~/server/http'
import { deleteSpaceService, updateSpaceService } from '~/server/services/spaces'

const updateSpaceSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(200).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
})

export const Route = createFileRoute('/api/v1/spaces/$id')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = z.string().uuid().parse(params.id)
          const body = updateSpaceSchema.parse(await request.json())
          const result = await updateSpaceService(ctx, { id, ...body })
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = z.string().uuid().parse(params.id)
          const result = await deleteSpaceService(ctx, { id })
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
