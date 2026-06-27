import { eq } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { auth } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'

/**
 * ServiceContext — the bridge between Web (session cookie) and CLI (API key).
 *
 * Every service function takes a `ServiceContext` as its first argument
 * instead of calling `getRequestHeaders()` directly. Both the Web's
 * `createServerFn` shims and the CLI's command handlers build one.
 */
export type ServiceContext = {
  userId: string
  /** The original request headers — useful for IP / audit logging. */
  headers: Headers
  /** Which credential produced this context. */
  authKind: 'session' | 'apiKey' | 'cli'
}

/**
 * Build a ServiceContext from request headers. Tries, in order:
 *   1. Session cookie (web's normal path) via `getSession`
 *   2. `x-api-key` header → better-auth apiKey plugin
 *   3. `Authorization: Bearer <token>`:
 *      - first try apiKey plugin (the CLI's distributed binary uses this
 *        to send its API Key)
 *      - then fall back to looking the token up directly in the `session`
 *        table — the CLI's distributed binary also supports session
 *        tokens obtained via `auth login` (HTTP-mode credential).
 */
export async function contextFromHeaders(headers: Headers): Promise<ServiceContext> {
  const session = await auth.api.getSession({ headers })
  if (session?.user?.id) {
    return { userId: session.user.id, headers, authKind: 'session' }
  }

  const bearer = parseBearerToken(headers.get('authorization'))
  const apiKeyHeader = headers.get('x-api-key') ?? bearer
  if (apiKeyHeader) {
    const apiKey = (await auth.api.verifyApiKey({
      body: { key: apiKeyHeader },
    })) as
      | { valid: true; key: { referenceId: string } | null }
      | { valid: false; key: null }
    if (apiKey?.valid && apiKey.key?.referenceId) {
      return { userId: apiKey.key.referenceId, headers, authKind: 'apiKey' }
    }
  }

  // Bearer didn't validate as an API key — try the session table directly.
  if (bearer) {
    const now = new Date()
    const sessionRow = await db.query.session.findFirst({
      where: eq(schema.session.token, bearer),
    })
    if (sessionRow && sessionRow.expiresAt > now) {
      return {
        userId: sessionRow.userId,
        headers,
        authKind: 'session',
      }
    }
  }

  throw Errors.unauthenticated()
}

/**
 * Extract a bearer token from an `Authorization: Bearer <token>` header
 * (RFC 6750). Case-insensitive scheme. Returns null if header is absent or
 * not in bearer form.
 */
function parseBearerToken(header: string | null): string | null {
  if (!header) return null
  const [scheme, token, ...rest] = header.trim().split(/\s+/)
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null
  return token
}

/**
 * Build a ServiceContext directly from a known userId. Use this when the
 * caller has already authenticated out-of-band (e.g. CLI `auth login`
 * calls signIn, then immediately wants to create an API key).
 */
export function contextForUser(
  userId: string,
  headers: Headers = new Headers(),
  authKind: ServiceContext['authKind'] = 'cli',
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