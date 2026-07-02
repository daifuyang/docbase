import { and, desc, eq } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { auth } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'
import { getClientIp, rateLimit } from '~/lib/rate-limit.server'
import type { PublicUser } from '~/shared/types'
import type { SignInInput, SignUpInput } from '~/shared/validation/user'
import { type ServiceContext, requireAdmin } from './context'

export async function getCurrentUserService(
  ctx: ServiceContext | null,
): Promise<PublicUser | null> {
  // Anonymous (or stale credentials): return null — never throw. The
  // root loader and `beforeLoad` guards use this to decide whether to
  // redirect to /auth/login.
  if (!ctx) return null
  const u = await db.query.user.findFirst({ where: eq(schema.user.id, ctx.userId) })
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }
}

export async function listMembersService(ctx: ServiceContext): Promise<{ items: PublicUser[] }> {
  await requireAdmin(ctx)
  const rows = await db.select().from(schema.user).orderBy(schema.user.createdAt)
  return {
    items: rows.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
  }
}

export async function signInService(input: SignInInput): Promise<{
  user: PublicUser
  session: { token: string; expiresAt: string }
}> {
  const headers = new Headers()
  const ip = getClientIp(headers)
  const rl = await rateLimit('auth:login', ip, 10, 60)
  if (!rl.allowed) throw Errors.rateLimited(rl.resetAt)

  let result: { user: { id: string; email: string }; token: string }
  try {
    let email = input.account
    if (!email.includes('@')) {
      const user = await db.query.user.findFirst({
        where: eq(schema.user.username, input.account),
      })
      if (!user) throw Errors.invalidCredentials()
      email = user.email
    }

    result = (await auth.api.signInEmail({
      body: { email, password: input.password },
      headers,
      asResponse: false,
    })) as { user: { id: string; email: string }; token: string }
  } catch {
    throw Errors.invalidCredentials()
  }

  const me = await db.query.user.findFirst({ where: eq(schema.user.id, result.user.id) })
  if (!me) throw Errors.invalidCredentials()

  return {
    user: {
      id: me.id,
      username: me.username,
      displayName: me.displayName,
      bio: me.bio,
      role: me.role,
      createdAt: me.createdAt.toISOString(),
    } satisfies PublicUser,
    session: {
      token: result.token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  }
}

export async function signOutService(_ctx: ServiceContext): Promise<{ ok: true }> {
  try {
    await auth.api.signOut({ headers: _ctx.headers })
  } catch {
    // ignore — best effort
  }
  return { ok: true }
}

export async function createMemberService(
  ctx: ServiceContext,
  input: SignUpInput,
): Promise<{ user: PublicUser }> {
  await requireAdmin(ctx)
  const headers = new Headers()

  const existingUsername = await db.query.user.findFirst({
    where: eq(schema.user.username, input.username),
  })
  if (existingUsername) throw Errors.usernameTaken()

  const result = (await auth.api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: input.displayName ?? input.username,
      username: input.username,
      displayName: input.displayName ?? input.username,
    },
    headers,
    asResponse: false,
  })) as { user: { id: string; email: string } }

  const member = await db.query.user.findFirst({ where: eq(schema.user.id, result.user.id) })
  if (!member) throw Errors.internal('成员创建成功但读取失败')
  return {
    user: {
      id: member.id,
      username: member.username,
      displayName: member.displayName,
      bio: member.bio,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
    } satisfies PublicUser,
  }
}

/**
 * Create a long-lived API key for the given user.
 * Called from authenticated server-side flows. The api-key plugin only
 * enforces session auth when request headers are passed into the plugin
 * call, so we validate the DocBase ServiceContext first and then pass the
 * trusted userId directly.
 */
export async function createApiKeyService(
  ctx: ServiceContext,
  input: {
    name?: string
    expiresIn?: number
  },
): Promise<{
  id: string
  key: string
  prefix: string | null
  userId: string
  createdAt: string
  expiresAt: string | null
}> {
  const created = (await auth.api.createApiKey({
    body: {
      userId: ctx.userId,
      name: input.name ?? 'api-key',
      expiresIn: input.expiresIn,
    },
    asResponse: false,
  })) as unknown as {
    id: string
    key: string
    prefix?: string | null
    userId: string
    createdAt: Date | string
    expiresAt?: Date | string | null
  }

  return {
    id: created.id,
    key: created.key,
    prefix: created.prefix ?? null,
    userId: ctx.userId,
    createdAt: toIsoString(created.createdAt),
    expiresAt: created.expiresAt ? toIsoString(created.expiresAt) : null,
  }
}

export async function listApiKeysService(ctx: ServiceContext): Promise<{
  items: Array<{
    id: string
    name: string | null
    prefix: string | null
    createdAt: string
    expiresAt: string | null
    lastRequest: string | null
  }>
}> {
  const rows = await db
    .select({
      id: schema.apikey.id,
      name: schema.apikey.name,
      prefix: schema.apikey.prefix,
      start: schema.apikey.start,
      createdAt: schema.apikey.createdAt,
      expiresAt: schema.apikey.expiresAt,
      lastRequest: schema.apikey.lastRequest,
    })
    .from(schema.apikey)
    .where(eq(schema.apikey.referenceId, ctx.userId))
    .orderBy(desc(schema.apikey.createdAt))

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix ?? row.start ?? null,
      createdAt: toIsoString(row.createdAt),
      expiresAt: row.expiresAt ? toIsoString(row.expiresAt) : null,
      lastRequest: row.lastRequest ? toIsoString(row.lastRequest) : null,
    })),
  }
}

export async function revokeApiKeyService(
  ctx: ServiceContext,
  input: { keyId: string },
): Promise<{ ok: true }> {
  const existing = await db.query.apikey.findFirst({
    where: and(eq(schema.apikey.id, input.keyId), eq(schema.apikey.referenceId, ctx.userId)),
    columns: { id: true },
  })
  if (!existing) throw Errors.notFound('访问令牌不存在')

  // Direct DB delete — bypasses session requirement (the api-key plugin
  // doesn't expose a server-only delete that skips auth checks).
  await db
    .delete(schema.apikey)
    .where(and(eq(schema.apikey.id, input.keyId), eq(schema.apikey.referenceId, ctx.userId)))
  return { ok: true }
}

// =============================================================================
// Internal helpers
// =============================================================================

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}
