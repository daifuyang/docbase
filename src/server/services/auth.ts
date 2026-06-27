import { eq } from 'drizzle-orm'
import * as schema from '~/../db/schema'
import { auth } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { Errors } from '~/lib/errors'
import { getClientIp, rateLimit } from '~/lib/rate-limit.server'
import type { PublicUser } from '~/shared/types'
import type { SignInInput, SignUpInput } from '~/shared/validation/user'
import { requireAdmin, type ServiceContext } from './context'

export async function getCurrentUserService(
  ctx: ServiceContext,
): Promise<PublicUser | null> {
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

export async function listMembersService(
  ctx: ServiceContext,
): Promise<{ items: PublicUser[] }> {
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

export async function signInService(
  input: SignInInput,
): Promise<{
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

export async function signUpService(
  input: SignUpInput,
): Promise<{
  user: PublicUser
  session: { token: string; expiresAt: string }
}> {
  const headers = new Headers()
  const ip = getClientIp(headers)
  const rl = await rateLimit('auth:register', ip, 5, 60)
  if (!rl.allowed) throw Errors.rateLimited(rl.resetAt)

  const existingUsername = await db.query.user.findFirst({
    where: eq(schema.user.username, input.username),
  })
  if (existingUsername) throw Errors.usernameTaken()

  let result: { user: { id: string; email: string }; token: string }
  try {
    result = (await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.displayName ?? input.username,
        username: input.username,
        displayName: input.displayName ?? input.username,
      },
      headers,
      asResponse: false,
    })) as { user: { id: string; email: string }; token: string }
  } catch (e: unknown) {
    const msg = (e as Error).message ?? ''
    if (msg.includes('exists') || msg.includes('already')) {
      throw Errors.emailTaken()
    }
    throw Errors.internal('注册失败，请稍后再试')
  }

  await db
    .update(schema.user)
    .set({
      username: input.username,
      displayName: input.displayName ?? input.username,
    })
    .where(eq(schema.user.id, result.user.id))

  const me = await db.query.user.findFirst({ where: eq(schema.user.id, result.user.id) })
  if (!me) throw Errors.internal('注册成功但读取用户失败')

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
 * Called from server-side (CLI's auth login) — we trust the userId from
 * signInService and pass it directly via body. The api-key plugin only
 * enforces session auth when ctx.request / ctx.headers is set, which we
 * intentionally omit here.
 */
export async function createApiKeyService(
  input: {
    userId: string
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
      userId: input.userId,
      name: input.name ?? 'cli',
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
    userId: input.userId,
    createdAt: toIsoString(created.createdAt),
    expiresAt: created.expiresAt ? toIsoString(created.expiresAt) : null,
  }
}

export async function listApiKeysService(
  ctx: ServiceContext,
): Promise<{
  items: Array<{
    id: string
    name: string | null
    prefix: string | null
    createdAt: string
    expiresAt: string | null
    lastRequest: string | null
  }>
}> {
  // listApiKeys requires a session — when called from CLI with an api key,
  // we can't satisfy that directly. For now we return an empty list and
  // recommend `auth logout` (which already knows the apiKeyId) for revocation.
  void ctx
  return { items: [] }
}

export async function revokeApiKeyService(
  _ctx: ServiceContext,
  input: { keyId: string },
): Promise<{ ok: true }> {
  // Direct DB delete — bypasses session requirement (the api-key plugin
  // doesn't expose a server-only delete that skips auth checks).
  await db.delete(schema.apikey).where(eq(schema.apikey.id, input.keyId))
  return { ok: true }
}

// =============================================================================
// Internal helpers
// =============================================================================

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}