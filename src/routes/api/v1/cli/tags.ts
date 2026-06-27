/**
 * /api/v1/cli/tags
 *   GET  — list tags (optional ?limit)
 *   POST — create tag (admin only; idempotent on name)
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import { createTagService, listTagsService } from '~/server/services/tags'
import { apiHandlers, bearerAuth, openApiRegistry, Tag } from '~/server/openapi'

const ListTagsQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).optional() })
const ListTagsResponse = z.object({ items: z.array(Tag) }).openapi('ListTagsResponse')

const CreateTagBody = z.object({ name: z.string().min(1).max(50) }).openapi('CreateTagBody')
const CreateTagResponse = z.object({ tag: Tag }).openapi('CreateTagResponse')

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/cli/tags',
  summary: '列出标签',
  security: [{ bearerAuth: [] }],
  request: { query: ListTagsQuery },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: ListTagsResponse } } },
  },
  tags: ['tags'],
})
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/cli/tags',
  summary: '创建标签（admin；同名幂等返回已有）',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateTagBody } }, required: true } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: CreateTagResponse } } },
    403: { description: '非管理员', content: { 'application/json': { schema: z.unknown() } } },
  },
  tags: ['tags'],
})

export const Route = createFileRoute('/api/v1/cli/tags')({
  server: {
    handlers: apiHandlers({
      GET: async ({ request }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const url = new URL(request.url)
        const q = ListTagsQuery.parse(Object.fromEntries(url.searchParams))
        return Response.json(await listTagsService(ctx, q))
      },
      POST: async ({ request }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const body = CreateTagBody.parse(await request.json())
        return Response.json(await createTagService(ctx, body), { status: 201 })
      },
    }),
  },
})

void bearerAuth
