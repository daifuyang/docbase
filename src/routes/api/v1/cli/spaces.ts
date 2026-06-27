/**
 * /api/v1/cli/spaces
 *   GET  — list all spaces
 *   POST — create space (admin only)
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import { createSpaceService, listSpacesService } from '~/server/services/spaces'
import { apiHandlers, bearerAuth, openApiRegistry, SpaceSummary } from '~/server/openapi'

const ListSpacesResponse = z.object({ items: z.array(SpaceSummary) }).openapi('ListSpacesResponse')

const CreateSpaceBody = z
  .object({
    name: z.string().min(1).max(60),
    description: z.string().max(200).optional(),
  })
  .openapi('CreateSpaceBody')

const CreateSpaceResponse = z.object({ space: SpaceSummary }).openapi('CreateSpaceResponse')

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/cli/spaces',
  summary: '列出所有知识空间',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: ListSpacesResponse } } },
    401: { description: '未认证', content: { 'application/json': { schema: z.unknown() } } },
  },
  tags: ['spaces'],
})
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/cli/spaces',
  summary: '创建知识空间（admin）',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateSpaceBody } },
      required: true,
    },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: CreateSpaceResponse } } },
    403: { description: '非管理员', content: { 'application/json': { schema: z.unknown() } } },
  },
  tags: ['spaces'],
})

export const Route = createFileRoute('/api/v1/cli/spaces')({
  server: {
    handlers: apiHandlers({
      GET: async () => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        return Response.json(await listSpacesService(ctx))
      },
      POST: async ({ request }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const body = CreateSpaceBody.parse(await request.json())
        return Response.json(await createSpaceService(ctx, body), { status: 201 })
      },
    }),
  },
})

void bearerAuth
