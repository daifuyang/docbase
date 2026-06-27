/**
 * POST /api/v1/cli/auth/login
 *
 * Sign in with username/email + password. Returns a user object and the
 * better-auth session token (NOT an API key — use `auth/login` web endpoint
 * for that). CLI uses this to obtain the session token it will then store
 * locally and re-send as a bearer token on subsequent calls.
 *
 * NOTE: this endpoint intentionally bypasses the web `signInService` rate
 * limit (which is keyed by IP and would lock out CI runners sharing an IP).
 * Rate limiting here is per-account (5/min) — same shape as the service
 * layer's failure-counter — so brute force is still throttled.
 */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Errors } from '~/lib/errors'
import { rateLimit } from '~/lib/rate-limit.server'
import { signInService } from '~/server/services/auth'
import { apiHandlers, bearerAuth, openApiRegistry, PublicUser } from '~/server/openapi'
import { signInSchema } from '~/shared/validation/user'

const LoginResponse = z
  .object({
    user: PublicUser,
    session: z.object({
      token: z.string(),
      expiresAt: z.string().datetime(),
    }),
  })
  .openapi('LoginResponse')

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/cli/auth/login',
  summary: '登录拿 session token',
  request: {
    body: {
      description: '账号 + 密码',
      content: { 'application/json': { schema: signInSchema } },
      required: true,
    },
  },
  security: [], // public endpoint — no bearer required
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: LoginResponse } } },
    401: { description: '账号或密码错误', content: { 'application/json': { schema: Errors } } },
    429: { description: '操作过于频繁', content: { 'application/json': { schema: Errors } } },
  },
  tags: ['auth'],
})

export const Route = createFileRoute('/api/v1/cli/auth/login')({
  server: {
    handlers: apiHandlers({
      POST: async ({ request }) => {
        const body = signInSchema.parse(await request.json())
        const rl = await rateLimit('cli:auth:login:fail', body.account, 5, 60).catch(
          () => ({ allowed: false as const, remaining: 0, resetAt: 0 }),
        )
        if (!rl.allowed) throw Errors.rateLimited(rl.resetAt)
        try {
          return Response.json(await signInService(body))
        } catch (e) {
          if (e instanceof Error && e.message?.includes('credentials')) {
            throw Errors.invalidCredentials()
          }
          throw e
        }
      },
    }),
  },
})

// Reference the registry export so it stays live even if the route handler
// is tree-shaken during a future bundle optimization.
void bearerAuth
