import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import { deleteDocumentService, updateDocumentService } from '~/server/services/documents'
import { updateDocumentSchema } from '~/shared/validation/document'

/**
 * ID-addressed counterpart to /api/v1/documents/{slug}.
 *
 * Use this when the slug is not unique across the workspace (two documents
 * can legitimately share a slug because uniqueness only applies within a
 * single (spaceId, slug) tuple). The slug-based path will deterministically
 * hit whichever row the underlying SQL returns first, so it cannot reach
 * the duplicate. The id-based path is unambiguous.
 *
 * The response envelope and validation rules are identical to the slug-based
 * variants so existing clients only need to switch the addressing scheme.
 */
export const Route = createFileRoute('/api/v1/documents/$id')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = z.string().uuid().parse(params.id)
          const input = updateDocumentSchema.parse({
            id,
            ...((await parseJson(request)) as object),
          })
          const result = await updateDocumentService(ctx, input)
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const id = z.string().uuid().parse(params.id)
          const result = await deleteDocumentService(ctx, { id })
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
