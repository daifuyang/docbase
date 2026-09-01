import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, requireApiContext } from '~/server/http'
import { deleteSpaceService } from '~/server/services/spaces'

export const Route = createFileRoute('/api/v1/spaces/$id')({
  server: {
    handlers: {
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
