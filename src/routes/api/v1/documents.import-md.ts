import { createFileRoute } from '@tanstack/react-router'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import { importMarkdownService } from '~/server/services/documents'
import { importMarkdownSchema } from '~/shared/validation/document'

export const Route = createFileRoute('/api/v1/documents/import-md')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ctx = await requireApiContext(request)
          const input = importMarkdownSchema.parse(await parseJson(request))
          const result = await importMarkdownService(ctx, input)
          return json(result, { status: 201 })
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
