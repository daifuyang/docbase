import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { contextFromHeaders, requireUserContext } from '~/server/services/context'
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
    listDocumentsService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data ?? {},
    ),
  )

export const searchDocuments = listDocuments

export const getDocumentBySlug = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) =>
    getDocumentBySlugService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data,
    ),
  )

export const createDocument = createServerFn({ method: 'POST' })
  .validator(createDocumentSchema)
  .handler(async ({ data }) =>
    createDocumentService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data,
    ),
  )

export const updateDocument = createServerFn({ method: 'POST' })
  .validator(updateDocumentSchema)
  .handler(async ({ data }) =>
    updateDocumentService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data,
    ),
  )

export const deleteDocument = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) =>
    deleteDocumentService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data,
    ),
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
    const ctx = requireUserContext(await contextFromHeaders(getRequestHeaders()))
    return listMyDocumentsService(ctx, { ...data })
  })
