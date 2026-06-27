/**
 * /api/v1/cli/documents/:slug
 *   GET    — full document (incl. contentHtml)
 *   PUT    — update fields (title / markdown / status / tags)
 *   DELETE — delete document
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import {
  deleteDocumentService,
  getDocumentBySlugService,
  updateDocumentService,
} from '~/server/services/documents'
import { markdownToTiptap } from '~/cli/markdown'
import { apiHandlers, bearerAuth, openApiRegistry } from '~/server/openapi'

const DocumentDetail = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullable(),
    status: z.string(),
    contentJson: z.unknown(),
    contentHtml: z.string(),
    space: z.unknown().nullable(),
    category: z.unknown().nullable(),
    tags: z.array(z.string()),
    creator: z.unknown(),
    updatedAt: z.string().datetime(),
    publishedAt: z.string().datetime().nullable(),
    viewCount: z.number().int(),
  })
  .openapi('DocumentDetail')

const PathParams = z.object({ slug: z.string() })

const UpdateDocumentBody = z
  .object({
    title: z.string().min(1).max(200).optional(),
    contentMarkdown: z.string().optional(),
    status: z.enum(['draft', 'published']).optional(),
    tags: z.array(z.string()).optional(),
  })
  .openapi('UpdateDocumentBody')

const UpdateDocumentResponse = z.object({ document: DocumentDetail }).openapi('UpdateDocumentResponse')

const DeleteDocumentResponse = z.object({ ok: z.literal(true) }).openapi('DeleteDocumentResponse')

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/cli/documents/{slug}',
  summary: '获取文档详情',
  security: [{ bearerAuth: [] }],
  request: { params: PathParams },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: DocumentDetail } } },
    404: { description: '未找到', content: { 'application/json': { schema: z.unknown() } } },
  },
  tags: ['documents'],
})
openApiRegistry.registerPath({
  method: 'put',
  path: '/api/v1/cli/documents/{slug}',
  summary: '更新文档',
  security: [{ bearerAuth: [] }],
  request: {
    params: PathParams,
    body: { content: { 'application/json': { schema: UpdateDocumentBody } }, required: true },
  },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: UpdateDocumentResponse } } },
  },
  tags: ['documents'],
})
openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/cli/documents/{slug}',
  summary: '删除文档',
  security: [{ bearerAuth: [] }],
  request: { params: PathParams },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: DeleteDocumentResponse } } },
  },
  tags: ['documents'],
})

export const Route = createFileRoute('/api/v1/cli/documents/$slug')({
  server: {
    handlers: apiHandlers({
      GET: async ({ params }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const { slug } = PathParams.parse(params)
        return Response.json(await getDocumentBySlugService(ctx, { slug }))
      },
      PUT: async ({ params, request }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const { slug } = PathParams.parse(params)
        const body = UpdateDocumentBody.parse(await request.json())
        const found = await getDocumentBySlugService(ctx, { slug })
        if (!found) throw new Response(null, { status: 404 })
        return Response.json(
          await updateDocumentService(ctx, {
            id: found.id,
            title: body.title,
            contentJson: body.contentMarkdown ? markdownToTiptap(body.contentMarkdown) : undefined,
            status: body.status,
            tags: body.tags,
          }),
        )
      },
      DELETE: async ({ params }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const { slug } = PathParams.parse(params)
        const found = await getDocumentBySlugService(ctx, { slug })
        if (!found) throw new Response(null, { status: 404 })
        return Response.json(await deleteDocumentService(ctx, { id: found.id }))
      },
    }),
  },
})

void bearerAuth
