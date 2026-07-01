import { apiKey } from '@better-auth/api-key'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import * as schema from '~/../db/schema'
import { db } from './db.server'
import './runtime-config.server'

const installModeSecret = 'docbase-install-mode-secret-placeholder-000000'
const secret = process.env.BETTER_AUTH_SECRET ?? installModeSecret

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
      // Disable the api-key plugin's default per-key rate limiting so that
      // CLI tests (and human users running many commands in a session) are
      // not blocked. Document-creation rate limiting is enforced separately
      // by src/lib/rate-limit.server.ts at the service layer.
      rateLimit: { enabled: false },
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
