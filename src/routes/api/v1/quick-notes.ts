import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import { createQuickNoteService, listQuickNotesService } from '~/server/services/quick-notes'

const createSchema = z.object({
  content: z.string().min(1).max(4000),
})

export const Route = createFileRoute('/api/v1/quick-notes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const url = new URL(request.url)
          const limitRaw = url.searchParams.get('limit')
          const limit = limitRaw ? Number(limitRaw) : undefined
          const result = await listQuickNotesService(ctx, {
            limit: Number.isFinite(limit) ? (limit as number) : undefined,
          })
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
      POST: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const body = await parseJson(request)
          const input = createSchema.parse(body)
          const note = await createQuickNoteService(ctx, input)
          return json({ note }, { status: 201 })
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
