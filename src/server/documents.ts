import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  contextFromHeaders,
} from '~/server/services/context'
import {
  createDocumentService,
  deleteDocumentService,
  getDocumentBySlugService,
  listDocumentsService,
  listMyDocumentsService,
  updateDocumentService,
} from '~/server/services/documents'
import {
  createDocumentSchema,
  searchDocumentsSchema,
  updateDocumentSchema,
} from '~/shared/validation/document'

export const listDocuments = createServerFn({ method: 'GET' })
  .validator(searchDocumentsSchema.optional())
  .handler(async ({ data }) =>
    listDocumentsService(await contextFromHeaders(getRequestHeaders()), data ?? {}),
  )

export const searchDocuments = listDocuments

export const getDocumentBySlug = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) =>
    getDocumentBySlugService(await contextFromHeaders(getRequestHeaders()), data),
  )

export const createDocument = createServerFn({ method: 'POST' })
  .validator(createDocumentSchema)
  .handler(async ({ data }) =>
    createDocumentService(await contextFromHeaders(getRequestHeaders()), data),
  )

export const updateDocument = createServerFn({ method: 'POST' })
  .validator(updateDocumentSchema)
  .handler(async ({ data }) =>
    updateDocumentService(await contextFromHeaders(getRequestHeaders()), data),
  )

export const deleteDocument = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) =>
    deleteDocumentService(await contextFromHeaders(getRequestHeaders()), data),
  )

export const listMyDocuments = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      status: z.enum(['draft', 'published']).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ data }) => {
    const ctx = await contextFromHeaders(getRequestHeaders())
    return listMyDocumentsService(ctx, { ...data })
  })