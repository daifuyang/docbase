import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import { createSpaceService, listSpacesService } from '~/server/services/spaces'

const createSpaceSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
})

export const Route = createFileRoute('/api/v1/spaces')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return json(await listSpacesService(await requireApiContext(request)))
        } catch (error) {
          return handleApiError(error)
        }
      },
      POST: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const input = createSpaceSchema.parse(await parseJson(request))
          return json(await createSpaceService(ctx, input), { status: 201 })
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
