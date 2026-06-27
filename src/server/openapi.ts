/**
 * OpenAPI 3.0 spec for the DocBase CLI HTTP API.
 *
 * Each server route in `src/routes/api/v1/cli/*.ts` registers itself here.
 * `/api/v1/openapi.json` (see src/routes/api/v1/openapi.json.ts) renders the
 * aggregated spec as JSON.
 *
 * Picked `@asteasolutions/zod-to-openapi` because it generates spec
 * directly from the same zod schemas used by the service layer — single
 * source of truth, no drift between validation and docs.
 */
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { ServerError } from '~/lib/errors'

// Augment zod so `.openapi()` is available on every schema. Has to run
// before any zod schema is exported with `.openapi()` metadata.
extendZodWithOpenApi(z)

// Shared zod schemas for OpenAPI — re-export so callers don't need to
// redefine them.
export const OpenApiError = z
  .object({
    code: z.string().openapi({ example: 'UNAUTHENTICATED' }),
    message: z.string().openapi({ example: 'API key 已过期' }),
    statusCode: z.number().openapi({ example: 401 }),
  })
  .openapi('ServerError')

export const PublicUser = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    role: z.enum(['admin', 'member']),
    createdAt: z.string().datetime(),
  })
  .openapi('PublicUser')

export const SpaceSummary = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
  })
  .openapi('SpaceSummary')

export const CategorySummary = z
  .object({
    id: z.string().uuid(),
    spaceId: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
  })
  .openapi('CategorySummary')

export const Tag = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  })
  .openapi('Tag')

/**
 * Singleton registry. Imported by every route file via
 * `registerOnOpenApiRegistry(myRouteConfig)` to contribute its metadata.
 */
export const openApiRegistry = new OpenAPIRegistry()

// Common bearer-auth security scheme reused by every protected route.
export const bearerAuth = openApiRegistry.registerComponent(
  'securitySchemes',
  'bearerAuth',
  {
    type: 'http',
    scheme: 'bearer',
    description: 'better-auth API Key, format `docbase_xxx...`',
  },
)

/**
 * Wrap a server route handler so `Errors.X(...)` thrown from the service
 * layer become a proper JSON response `{ code, message, statusCode }`
 * matching the CLI's expected error shape.
 *
 * Anything else bubbles up unchanged (TanStack Start's default 500).
 */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (err) {
      if (err instanceof ServerError) {
        return Response.json(
          { code: err.code, message: err.message, statusCode: err.statusCode },
          { status: err.statusCode },
        )
      }
      // Zod validation errors from `Body.parse` carry a useful `.message`.
      if (err instanceof z.ZodError) {
        return Response.json(
          {
            code: 'VALIDATION_ERROR',
            message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
            statusCode: 400,
          },
          { status: 400 },
        )
      }
      throw err
    }
  }
}

/**
 * Wrap a record of method handlers in one call:
 *   server: { handlers: apiHandlers({ GET: async () => ... }) }
 */
// biome-ignore lint/suspicious/noExplicitAny: inference is too narrow with `never[]`
export function apiHandlers<T extends Record<string, (...args: any[]) => Promise<Response>>>(
  handlers: T,
): T {
  return Object.fromEntries(
    Object.entries(handlers).map(([method, h]) => [method, withApiErrors(h)]),
  ) as T
}
