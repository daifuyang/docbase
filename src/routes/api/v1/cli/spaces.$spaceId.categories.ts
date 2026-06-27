/**
 * /api/v1/cli/spaces/:spaceId/categories
 *   GET  — list categories in a space
 *   POST — create category in a space (admin only)
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import {
  createCategoryService,
  listCategoriesBySpaceService,
} from '~/server/services/spaces'
import { apiHandlers, bearerAuth, CategorySummary, openApiRegistry } from '~/server/openapi'

const ListCategoriesResponse = z
  .object({ items: z.array(CategorySummary) })
  .openapi('ListCategoriesResponse')

const CreateCategoryBody = z
  .object({
    name: z.string().min(1).max(60),
    description: z.string().max(200).optional(),
  })
  .openapi('CreateCategoryBody')

const CreateCategoryResponse = z.object({ category: CategorySummary }).openapi('CreateCategoryResponse')

const PathParams = z.object({ spaceId: z.string().uuid() })

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/cli/spaces/{spaceId}/categories',
  summary: '列出空间下分类',
  security: [{ bearerAuth: [] }],
  request: { params: PathParams },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: ListCategoriesResponse } } },
  },
  tags: ['categories'],
})
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/cli/spaces/{spaceId}/categories',
  summary: '创建分类（admin）',
  security: [{ bearerAuth: [] }],
  request: {
    params: PathParams,
    body: { content: { 'application/json': { schema: CreateCategoryBody } }, required: true },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: CreateCategoryResponse } } },
    403: { description: '非管理员', content: { 'application/json': { schema: z.unknown() } } },
  },
  tags: ['categories'],
})

export const Route = createFileRoute('/api/v1/cli/spaces/$spaceId/categories')({
  server: {
    handlers: apiHandlers({
      GET: async ({ params }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const { spaceId } = PathParams.parse(params)
        return Response.json(await listCategoriesBySpaceService(ctx, { spaceId }))
      },
      POST: async ({ params, request }) => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        const { spaceId } = PathParams.parse(params)
        const body = CreateCategoryBody.parse(await request.json())
        return Response.json(await createCategoryService(ctx, { spaceId, ...body }), {
          status: 201,
        })
      },
    }),
  },
})

void bearerAuth
