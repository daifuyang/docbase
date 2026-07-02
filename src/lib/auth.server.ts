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
  // trustedOrigins：白名单 Origin / Host 头。
  // 必要原因：FC custom.debian12 + fc3 部署时只有 fcapp.run 系统 URL；用户从浏览器
  // 访问生产域 docbase.zerocmf.com（由 fc3-domain 绑定的自定义域名），
  // 但任何从 *.fcapp.run 域或本地域直接打过来的请求都会被 better-auth 拦截。
  // 这里把生产域、本地 dev 端口、FC 系统 URL 都放进白名单，CI 验证也能用。
  // 多值来源：环境变量 BETTER_AUTH_TRUSTED_ORIGINS（逗号分隔）+ 静态回退。
  trustedOrigins: [
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
    process.env.BETTER_AUTH_URL,
    'http://localhost:3000',
    'http://localhost:9000',
    'https://docbase-web-bwkfqflofz.cn-shanghai.fcapp.run', // FC 系统 URL（仅供调试/回滚时使用）
  ].filter(Boolean) as string[],
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
    apiKey({
      // API clients may send this header; the web UI uses session cookies.
      apiKeyHeaders: ['x-api-key'],
      enableMetadata: true,
      defaultPrefix: 'docbase_',
      // Disable the api-key plugin's default per-key rate limiting so that
      // scripted API clients are not blocked. Document-creation rate limiting
      // is enforced separately by src/lib/rate-limit.server.ts at the service layer.
      rateLimit: { enabled: false },
    }),
    tanstackStartCookies(),
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
