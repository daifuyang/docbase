import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { eq, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '~/../db/schema'

const email = requireEnv('DOCBASE_ADMIN_EMAIL').toLowerCase()
const username = requireEnv('DOCBASE_ADMIN_USERNAME')
const password = requireEnv('DOCBASE_ADMIN_PASSWORD')
const displayName = process.env.DOCBASE_ADMIN_DISPLAY_NAME || username || 'admin'
const resetPassword = process.env.DOCBASE_ADMIN_RESET_PASSWORD === 'true'
const client = postgres(requireEnv('DATABASE_URL'), { max: 1, prepare: false })
const db = drizzle(client, { schema })
const now = new Date()

try {
  const matches = await db
    .select()
    .from(schema.user)
    .where(or(eq(schema.user.email, email), eq(schema.user.username, username)))
    .limit(2)

  const matchedIds = new Set(matches.map((user) => user.id))
  if (matchedIds.size > 1) {
    throw new Error('DOCBASE_ADMIN_EMAIL and DOCBASE_ADMIN_USERNAME match different users')
  }

  const existing = matches[0]
  if (existing) {
    await db
      .update(schema.user)
      .set({
        email,
        username,
        name: displayName,
        displayName,
        role: 'admin',
        updatedAt: now,
      })
      .where(eq(schema.user.id, existing.id))

    const accounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, existing.id))

    const credential = accounts.find((account) => account.providerId === 'credential')
    if (credential && resetPassword) {
      await db
        .update(schema.account)
        .set({
          accountId: existing.id,
          providerId: 'credential',
          password: await hashPassword(password),
          updatedAt: now,
        })
        .where(eq(schema.account.id, credential.id))
      console.log(`admin ensured with password reset: ${email}`)
    } else if (!credential) {
      await db.insert(schema.account).values({
        id: randomBytes(16).toString('hex'),
        userId: existing.id,
        accountId: existing.id,
        providerId: 'credential',
        password: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      })
      console.log(`admin ensured with credential account: ${email}`)
    } else {
      console.log(`admin ensured without password reset: ${email}`)
    }
  } else {
    const userId = randomBytes(16).toString('hex')
    await db.insert(schema.user).values({
      id: userId,
      email,
      emailVerified: true,
      name: displayName,
      username,
      displayName,
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(schema.account).values({
      id: randomBytes(16).toString('hex'),
      userId,
      accountId: userId,
      providerId: 'credential',
      password: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    })
    console.log(`admin created: ${email}`)
  }
} finally {
  await client.end({ timeout: 1 }).catch(() => undefined)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}
