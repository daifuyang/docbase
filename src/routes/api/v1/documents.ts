import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import {
  createDocumentService,
  listDocumentsService,
  listMyDocumentsService,
} from '~/server/services/documents'
import { createDocumentSchema, searchDocumentsSchema } from '~/shared/validation/document'

const listDocumentsQuerySchema = searchDocumentsSchema.extend({
  mine: z.coerce.boolean().optional(),
  status: z.enum(['draft', 'published']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const Route = createFileRoute('/api/v1/documents')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const url = new URL(request.url)
          const query = listDocumentsQuerySchema.parse(Object.fromEntries(url.searchParams))
          const result = query.mine
            ? await listMyDocumentsService(ctx, query)
            : await listDocumentsService(ctx, query)
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
      POST: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const input = createDocumentSchema.parse(await parseJson(request))
          const result = await createDocumentService(ctx, input)
          return json(result, { status: 201 })
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
