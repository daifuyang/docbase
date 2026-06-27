/**
 * POST /api/v1/cli/auth/logout
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import { signOutService } from '~/server/services/auth'
import { apiHandlers, bearerAuth, openApiRegistry } from '~/server/openapi'

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/cli/auth/logout',
  summary: '登出（撤销当前 session）',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } } },
  },
  tags: ['auth'],
})

export const Route = createFileRoute('/api/v1/cli/auth/logout')({
  server: {
    handlers: apiHandlers({
      POST: async () => {
        const ctx = await contextFromHeaders(getRequestHeaders())
        return Response.json(await signOutService(ctx))
      },
    }),
  },
})

void bearerAuth
