/**
 * GET /api/v1/cli/auth/whoami
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import { getCurrentUserService } from '~/server/services/auth'
import { apiHandlers, bearerAuth, openApiRegistry, PublicUser } from '~/server/openapi'

const WhoamiResponse = PublicUser.nullable().openapi('WhoamiResponse')

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/cli/auth/whoami',
  summary: '查看当前登录用户',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: WhoamiResponse } } },
    401: { description: '未认证', content: { 'application/json': { schema: z.unknown() } } },
  },
  tags: ['auth'],
})

export const Route = createFileRoute('/api/v1/cli/auth/whoami')({
  server: {
    handlers: apiHandlers({
      GET: async () => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        return Response.json(await getCurrentUserService(ctx))
      },
    }),
  },
})

void bearerAuth
