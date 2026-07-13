import { createFileRoute } from '@tanstack/react-router'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import {
  deleteDocumentService,
  findDocumentIdBySlugService,
  getDocumentBySlugService,
  updateDocumentService,
} from '~/server/services/documents'
import { updateDocumentSchema } from '~/shared/validation/document'

export const Route = createFileRoute('/api/v1/documents/$slug')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const document = await getDocumentBySlugService(ctx, { slug: params.slug })
          if (!document)
            return json({ ok: false, code: 'NOT_FOUND', error: '文档不存在' }, { status: 404 })
          return json({ document })
        } catch (error) {
          return handleApiError(error)
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const target = await findDocumentIdBySlugService(ctx, { slug: params.slug })
          if (!target)
            return json({ ok: false, code: 'NOT_FOUND', error: '文档不存在' }, { status: 404 })
          const body = await parseJson(request)
          const input = updateDocumentSchema.parse({
            id: target.id,
            ...(body && typeof body === 'object' ? body : {}),
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
          const target = await findDocumentIdBySlugService(ctx, { slug: params.slug })
          if (!target)
            return json({ ok: false, code: 'NOT_FOUND', error: '文档不存在' }, { status: 404 })
          const result = await deleteDocumentService(ctx, { id: target.id })
          return json(result)
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
