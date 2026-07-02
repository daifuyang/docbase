import { createFileRoute } from '@tanstack/react-router'
import { handleApiError, json, requireApiContext } from '~/server/http'
import { listSpaceTreeService } from '~/server/services/spaces'

export const Route = createFileRoute('/api/v1/spaces/tree')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return json(await listSpaceTreeService(await requireApiContext(request)))
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
