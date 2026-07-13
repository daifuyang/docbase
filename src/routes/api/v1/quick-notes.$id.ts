import { createFileRoute } from '@tanstack/react-router'
import { handleApiError, json, requireApiContext } from '~/server/http'
import { deleteQuickNoteService } from '~/server/services/quick-notes'

export const Route = createFileRoute('/api/v1/quick-notes/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = String(params.id)
          await deleteQuickNoteService(ctx, { id })
          return json({ ok: true })
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
