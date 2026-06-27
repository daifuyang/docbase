import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { apiKey } from '@better-auth/api-key'
import * as schema from '~/../db/schema'
import { db } from './db.server'

const secret = process.env.BETTER_AUTH_SECRET
if (!secret || secret.length < 32) {
  throw new Error('BETTER_AUTH_SECRET must be set and >=32 chars')
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      apikey: schema.apikey,
    },
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    cookiePrefix: 'docbase',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  plugins: [
    tanstackStartCookies(),
    apiKey({
      // Header the CLI sends; the web UI uses session cookies.
      apiKeyHeaders: ['x-api-key'],
      enableMetadata: true,
      defaultPrefix: 'docbase_',
      // better-auth's documented default is 24h / 10 req — too strict for
      // batch CLI scripts (every `pnpm cli xxx` invocation counts as one).
      // The "secret" preset from the official docs is 1h / 1000 req, which
      // is enough headroom for any realistic CLI session while still
      // throttling brute-force attempts against a leaked key.
      rateLimit: {
        enabled: true,
        timeWindow: 60 * 60 * 1000, // 1 hour
        maxRequests: 1000,
      },
    }),
  ],
  // Custom additional fields that we need in the user table.
  // Without this, better-auth INSERTs without `username` (NOT NULL → fails).
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        input: true, // accept at signup
      },
      displayName: {
        type: 'string',
        required: false,
        input: true,
      },
      bio: {
        type: 'string',
        required: false,
        input: true,
      },
      role: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
})

export type Auth = typeof auth
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>
