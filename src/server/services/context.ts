import { eq } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { auth } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'

/**
 * ServiceContext — the bridge between Web session cookies and API keys.
 *
 * Every service function takes a `ServiceContext` as its first argument
 * instead of calling `getRequestHeaders()` directly.
 *
 * Semantics:
 *   - `userId: string`     — always a valid user id (callers are responsible
 *                            for either authenticating or accepting the null
 *                            from `contextFromHeaders`).
 *   - `authKind: 'session' | 'apiKey' | 'system'` — how the caller authenticated.
 *   - `headers`            — original request headers (for IP / audit logging).
 *
 * To distinguish "no credentials" from "wrong credentials", use the nullable
 * builder (`contextFromHeaders`) and either bail early or call
 * `requireUserContext`.
 */
export type ServiceContext = {
  userId: string
  /** The original request headers — useful for IP / audit logging. */
  headers: Headers
  /** Which credential produced this context. */
  authKind: 'session' | 'apiKey' | 'system'
}

/**
 * Resolve credentials from request headers. Returns `null` for anonymous
 * requests — callers that need an authenticated user must call
 * `requireUserContext` (or short-circuit) themselves.
 *
 * Tries session cookie first (the Web's normal path); falls back to the
 * `x-api-key` header (validated by the @better-auth/api-key
 * plugin).
 */
export async function contextFromHeaders(headers: Headers): Promise<ServiceContext | null> {
  const session = await auth.api.getSession({ headers })
  if (session?.user?.id) {
    return { userId: session.user.id, headers, authKind: 'session' }
  }

  // The api-key plugin's verifyApiKey needs the key in the body.
  const apiKeyHeader = headers.get('x-api-key')
  if (apiKeyHeader) {
    const apiKey = (await auth.api.verifyApiKey({
      body: { key: apiKeyHeader },
    })) as { valid: true; key: { referenceId: string } | null } | { valid: false; key: null }
    if (apiKey?.valid && apiKey.key?.referenceId) {
      return { userId: apiKey.key.referenceId, headers, authKind: 'apiKey' }
    }
  }

  return null
}

/**
 * Throw UNAUTHENTICATED when ctx is null. Use this at the top of any
 * service function that requires a logged-in user.
 */
export function requireUserContext(ctx: ServiceContext | null): ServiceContext {
  if (!ctx) throw Errors.unauthenticated()
  return ctx
}

/**
 * Build a ServiceContext directly from a known userId. Use this when the
 * caller has already authenticated out-of-band.
 */
export function contextForUser(
  userId: string,
  headers: Headers = new Headers(),
  authKind: ServiceContext['authKind'] = 'system',
): ServiceContext {
  return { userId, headers, authKind }
}

/**
 * Throw unless the current user has the `admin` role.
 * Returns the full DB user row (admin-only callers typically need it).
 */
export async function requireAdmin(ctx: ServiceContext): Promise<typeof schema.user.$inferSelect> {
  const u = await db.query.user.findFirst({ where: eq(schema.user.id, ctx.userId) })
  if (!u) throw Errors.unauthenticated()
  if (u.role !== 'admin') throw Errors.forbidden('仅管理员可执行该操作')
  return u
}
