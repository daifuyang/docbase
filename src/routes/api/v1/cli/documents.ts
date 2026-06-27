/**
 * /api/v1/cli/documents
 *   GET  — list / search documents (query params filter)
 *   POST — create document (admin/member with permission)
 *
 * Body for create accepts markdown directly (string); server converts to
 * TipTap JSON via the existing markdownToTiptap helper.
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import { createDocumentService, listDocumentsService } from '~/server/services/documents'
import { markdownToTiptap } from '~/cli/markdown'
import { apiHandlers, bearerAuth, openApiRegistry } from '~/server/openapi'
import { searchDocumentsSchema } from '~/shared/validation/document'

const DocumentSummary = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullable(),
    status: z.enum(['draft', 'published']),
    spaceId: z.string().uuid().nullable(),
    categoryId: z.string().uuid().nullable(),
    updatedAt: z.string().datetime(),
  })
  .openapi('DocumentSummary')

const ListDocumentsResponse = z
  .object({
    items: z.array(DocumentSummary),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
  .openapi('ListDocumentsResponse')

const CreateDocumentBody = z
  .object({
    title: z.string().min(1).max(200),
    /** Markdown source — server converts to TipTap JSON. */
    contentMarkdown: z.string().min(1),
    spaceId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    tags: z.array(z.string()).default([]),
  })
  .openapi('CreateDocumentBody')

const CreateDocumentResponse = z
  .object({
    document: z.object({
      id: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      status: z.string(),
    }),
  })
  .openapi('CreateDocumentResponse')

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/cli/documents',
  summary: '列出/搜索文档',
  security: [{ bearerAuth: [] }],
  request: { query: searchDocumentsSchema },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: ListDocumentsResponse } } },
  },
  tags: ['documents'],
})
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/cli/documents',
  summary: '创建文档',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateDocumentBody } }, required: true },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: CreateDocumentResponse } } },
  },
  tags: ['documents'],
})

export const Route = createFileRoute('/api/v1/cli/documents')({
  server: {
    handlers: apiHandlers({
      GET: async ({ request }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const url = new URL(request.url)
        const query = Object.fromEntries(url.searchParams)
        const input = searchDocumentsSchema.parse(query)
        return Response.json(await listDocumentsService(ctx, input))
      },
      POST: async ({ request }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const body = CreateDocumentBody.parse(await request.json())
        const contentJson = markdownToTiptap(body.contentMarkdown)
        return Response.json(
          await createDocumentService(ctx, {
            title: body.title,
            contentJson,
            spaceId: body.spaceId,
            categoryId: body.categoryId,
            status: body.status,
            tags: body.tags,
          }),
          { status: 201 },
        )
      },
    }),
  },
})

void bearerAuth
