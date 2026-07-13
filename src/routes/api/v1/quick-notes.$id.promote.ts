import { createFileRoute } from '@tanstack/react-router'
import { handleApiError, json, requireApiContext } from '~/server/http'
import { promoteQuickNoteService } from '~/server/services/quick-notes'

export const Route = createFileRoute('/api/v1/quick-notes/$id/promote')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = String(params.id)
          const result = await promoteQuickNoteService(ctx, { id })
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
