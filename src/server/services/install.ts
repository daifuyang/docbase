import { randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { apiKey } from '@better-auth/api-key'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { hashPassword } from 'better-auth/crypto'
import { eq, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import Redis from 'ioredis'
import postgres from 'postgres'
import * as schema from '~/../db/schema'
import {
  type RuntimeConfig,
  getConfigDir,
  getConfigPath,
  getInstallLockPath,
  getInstallingLockPath,
  isFcDeployMode,
  loadRuntimeConfig,
  readEnvRuntimeConfig,
  readRuntimeConfig,
} from '~/lib/runtime-config.server'
import { ensureMigrationsApplied } from '~/lib/migrate-on-boot.server'
import type { InstallConfigInput, InstallInput } from '~/shared/validation/install'

export type InstallState = {
  status: 'ready' | 'needs-install' | 'installing' | 'config-error' | 'broken'
  hasConfig: boolean
  hasLock: boolean
  db: 'unknown' | 'up' | 'down'
  redis: 'unknown' | 'up' | 'down'
  hasAdmin: boolean
  message: string
}

type CheckResult = { ok: boolean; message: string }

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

export async function getInstallGuardState(): Promise<
  Pick<InstallState, 'status' | 'hasConfig' | 'hasLock' | 'message'>
> {
  if (isFcDeployMode()) {
    // Block the first request until the boot-time migrator has had a
    // chance to finish — otherwise we serve a "ready" guard while the
    // schema is still out of date and every query 500s.
    await ensureMigrationsApplied()
    return {
      status: 'ready',
      hasConfig: Boolean(readEnvRuntimeConfig()),
      hasLock: true,
      message: 'FC 生产模式已关闭 Web 安装向导。',
    }
  }

  const hasConfigFile = existsSync(getConfigPath())
  const hasConfig = hasConfigFile || Boolean(readEnvRuntimeConfig())
  const hasLock = isInstallLocked()

  if (hasConfig && hasLock) {
    return {
      status: 'ready',
      hasConfig,
      hasLock,
      message: '系统已安装。',
    }
  }

  return {
    status: 'needs-install',
    hasConfig,
    hasLock,
    message: '系统尚未安装。',
  }
}

export async function getInstallStateService(): Promise<InstallState> {
  if (isFcDeployMode()) {
    return {
      status: 'ready',
      hasConfig: Boolean(readEnvRuntimeConfig()),
      hasLock: true,
      db: 'unknown',
      redis: 'unknown',
      hasAdmin: false,
      message: 'FC 生产模式已关闭 Web 安装向导。',
    }
  }

  const hasConfigFile = existsSync(getConfigPath())
  const envConfig = readEnvRuntimeConfig()
  const hasConfig = hasConfigFile || Boolean(envConfig)
  const hasLock = isInstallLocked()
  const installing = existsSync(getInstallingLockPath())

  if (installing && !hasLock) {
    return {
      status: 'installing',
      hasConfig,
      hasLock,
      db: 'unknown',
      redis: 'unknown',
      hasAdmin: false,
      message: '系统正在安装，请稍后刷新。',
    }
  }

  if (!hasConfig && !hasLock) {
    return {
      status: 'needs-install',
      hasConfig,
      hasLock,
      db: 'unknown',
      redis: 'unknown',
      hasAdmin: false,
      message: '系统尚未安装。',
    }
  }

  const config = safeReadConfig() ?? envConfig
  if (!config) {
    return {
      status: 'config-error',
      hasConfig,
      hasLock,
      db: 'unknown',
      redis: 'unknown',
      hasAdmin: false,
      message: '配置文件无法读取或格式不正确。',
    }
  }

  const [dbCheck, redisCheck, hasAdmin] = await Promise.all([
    checkDatabase(config.databaseUrl),
    checkRedis(config.redisUrl),
    hasAdminUser(config.databaseUrl),
  ])

  if (!dbCheck.ok || !redisCheck.ok) {
    return {
      status: 'config-error',
      hasConfig,
      hasLock,
      db: dbCheck.ok ? 'up' : 'down',
      redis: redisCheck.ok ? 'up' : 'down',
      hasAdmin,
      message: '系统配置异常，请检查数据库或 Redis 连接。',
    }
  }

  if (!hasLock) {
    return {
      status: 'needs-install',
      hasConfig,
      hasLock,
      db: 'up',
      redis: 'up',
      hasAdmin,
      message: hasAdmin
        ? '检测到数据库已有用户。安装前请确认数据库为空，或恢复安装锁。'
        : '检测到配置，请继续完成安装。',
    }
  }

  if (!hasAdmin) {
    return {
      status: 'broken',
      hasConfig,
      hasLock,
      db: 'up',
      redis: 'up',
      hasAdmin,
      message: '安装锁存在，但未找到管理员账号。',
    }
  }

  return {
    status: 'ready',
    hasConfig,
    hasLock,
    db: 'up',
    redis: 'up',
    hasAdmin,
    message: '系统已安装。',
  }
}

export async function testInstallConfigService(input: InstallConfigInput): Promise<{
  database: CheckResult
  redis: CheckResult
  configDir: CheckResult
  hasUsers: boolean
}> {
  assertInstallRateLimit('test')
  assertInstallAllowed()

  const [database, redis] = await Promise.all([
    checkDatabase(input.databaseUrl),
    checkRedis(input.redisUrl),
  ])
  const configDir = checkConfigDirWritable()
  const hasUsers = database.ok ? await hasAnyUser(input.databaseUrl) : false
  return { database, redis, configDir, hasUsers }
}

export async function runInstallService(input: InstallInput): Promise<{ ok: true }> {
  assertInstallRateLimit('run')
  assertInstallAllowed()

  createInstallingLock()
  try {
    const database = await checkDatabase(input.databaseUrl)
    if (!database.ok) throw new Error(database.message)
    const redis = await checkRedis(input.redisUrl)
    if (!redis.ok) throw new Error(redis.message)
    const configDir = checkConfigDirWritable()
    if (!configDir.ok) throw new Error(configDir.message)

    const config: RuntimeConfig = {
      databaseUrl: input.databaseUrl,
      redisUrl: input.redisUrl,
      betterAuthSecret: randomBytes(32).toString('hex'),
      betterAuthUrl: input.appUrl,
      publicAppUrl: input.appUrl,
    }

    writeRuntimeConfig(config)
    process.env.DATABASE_URL = config.databaseUrl
    process.env.REDIS_URL = config.redisUrl
    process.env.BETTER_AUTH_SECRET = config.betterAuthSecret
    process.env.BETTER_AUTH_URL = config.betterAuthUrl
    process.env.PUBLIC_APP_URL = config.publicAppUrl

    await migrateDatabase(config.databaseUrl)
    await upsertAdminUser(config, input)
    writeInstallLock()
    loadRuntimeConfig()
    return { ok: true }
  } finally {
    removeInstallingLock()
  }
}

function safeReadConfig(): RuntimeConfig | null {
  try {
    return readRuntimeConfig()
  } catch {
    return null
  }
}

function assertInstallAllowed() {
  if (isFcDeployMode()) throw new Error('FC 生产模式已关闭 Web 安装接口。')
  if (isInstallLocked()) throw new Error('系统已安装，安装接口已关闭。')
  if (existsSync(getInstallingLockPath())) throw new Error('系统正在安装，请稍后再试。')
}

function isInstallLocked(): boolean {
  return process.env.DOCBASE_INSTALLED === 'true' || existsSync(getInstallLockPath())
}

function assertInstallRateLimit(bucket: string) {
  const now = Date.now()
  const key = bucket
  const current = rateLimitBuckets.get(key)
  if (!current || current.resetAt < now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + 60_000 })
    return
  }
  if (current.count >= (bucket === 'run' ? 3 : 20)) {
    throw new Error('操作过于频繁，请稍后再试。')
  }
  current.count += 1
}

async function checkDatabase(databaseUrl: string): Promise<CheckResult> {
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5, prepare: false })
  try {
    await client`select 1`
    return { ok: true, message: 'PostgreSQL 连接成功。' }
  } catch (error) {
    return { ok: false, message: formatError(error, 'PostgreSQL 连接失败。') }
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined)
  }
}

async function checkRedis(redisUrl: string): Promise<CheckResult> {
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: () => null,
  })
  client.on('error', () => undefined)
  try {
    await client.connect()
    const pong = await client.ping()
    return pong === 'PONG'
      ? { ok: true, message: 'Redis 连接成功。' }
      : { ok: false, message: 'Redis 未返回 PONG。' }
  } catch (error) {
    return { ok: false, message: formatError(error, 'Redis 连接失败。') }
  } finally {
    client.disconnect()
  }
}

function checkConfigDirWritable(): CheckResult {
  try {
    mkdirSync(getConfigDir(), { recursive: true, mode: 0o700 })
    const probe = `${getConfigDir()}/.write-test-${process.pid}`
    writeFileSync(probe, 'ok', { mode: 0o600 })
    rmSync(probe, { force: true })
    return { ok: true, message: '配置目录可写。' }
  } catch (error) {
    return { ok: false, message: formatError(error, '配置目录不可写。') }
  }
}

async function hasAnyUser(databaseUrl: string): Promise<boolean> {
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5, prepare: false })
  const db = drizzle(client, { schema })
  try {
    const rows = await db.select({ id: schema.user.id }).from(schema.user).limit(1)
    return rows.length > 0
  } catch {
    return false
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined)
  }
}

async function hasAdminUser(databaseUrl: string): Promise<boolean> {
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5, prepare: false })
  const db = drizzle(client, { schema })
  try {
    const rows = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.role, 'admin'))
      .limit(1)
    return rows.length > 0
  } catch {
    return false
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined)
  }
}

async function migrateDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 1, prepare: false })
  const db = drizzle(client, { schema })
  try {
    try {
      await migrate(db, { migrationsFolder: 'db/migrations' })
    } catch (error) {
      const isPermissionError = (err: unknown): boolean => {
        const msg = err instanceof Error ? err.message : ''
        const causeMsg = err instanceof Error && err.cause ? (err.cause as Error).message : ''
        const fullMsg = msg + causeMsg
        return /permission denied|access denied|must be owner/i.test(fullMsg)
      }
      if (!isPermissionError(error)) throw error
      await migrate(db, {
        migrationsFolder: 'db/migrations',
        migrationsSchema: 'public',
      })
    }
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined)
  }
}

async function upsertAdminUser(config: RuntimeConfig, input: InstallInput) {
  const client = postgres(config.databaseUrl, { max: 1, prepare: false })
  const db = drizzle(client, { schema })
  const installAuth = betterAuth({
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
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    emailAndPassword: { enabled: true, autoSignIn: false, minPasswordLength: 8 },
    plugins: [apiKey({ apiKeyHeaders: ['x-api-key'], enableMetadata: true })],
    user: {
      additionalFields: {
        username: { type: 'string', required: true, input: true },
        displayName: { type: 'string', required: false, input: true },
        bio: { type: 'string', required: false, input: true },
        role: { type: 'string', required: false, input: false },
      },
    },
  })

  try {
    const matches = await db
      .select()
      .from(schema.user)
      .where(
        or(
          eq(schema.user.email, input.admin.email),
          eq(schema.user.username, input.admin.username),
        ),
      )
      .limit(2)

    const matchedIds = new Set(matches.map((user) => user.id))
    if (matchedIds.size > 1) {
      throw new Error('邮箱和用户名分别属于不同账号，请更换管理员邮箱或用户名。')
    }

    const existing = matches[0]
    if (existing) {
      const now = new Date()
      const password = await hashPassword(input.admin.password)
      await db
        .update(schema.user)
        .set({
          email: input.admin.email,
          username: input.admin.username,
          name: input.admin.displayName,
          displayName: input.admin.displayName,
          role: 'admin',
          updatedAt: now,
        })
        .where(eq(schema.user.id, existing.id))

      const accounts = await db
        .select({ id: schema.account.id })
        .from(schema.account)
        .where(eq(schema.account.userId, existing.id))

      const account = accounts[0]
      if (account) {
        await db
          .update(schema.account)
          .set({ accountId: input.admin.email, providerId: 'credential', password, updatedAt: now })
          .where(eq(schema.account.id, account.id))
      } else {
        await db.insert(schema.account).values({
          id: randomBytes(16).toString('hex'),
          userId: existing.id,
          accountId: input.admin.email,
          providerId: 'credential',
          password,
        })
      }
      return
    }

    const result = (await installAuth.api.signUpEmail({
      body: {
        email: input.admin.email,
        password: input.admin.password,
        name: input.admin.displayName,
        username: input.admin.username,
        displayName: input.admin.displayName,
      } as never,
      asResponse: false,
    })) as { user: { id: string } }
    await db.update(schema.user).set({ role: 'admin' }).where(eq(schema.user.id, result.user.id))
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined)
  }
}

function writeRuntimeConfig(config: RuntimeConfig) {
  mkdirSync(dirname(getConfigPath()), { recursive: true, mode: 0o700 })
  writeFileSync(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

function createInstallingLock() {
  mkdirSync(dirname(getInstallingLockPath()), { recursive: true, mode: 0o700 })
  const fd = openSync(getInstallingLockPath(), 'wx', 0o600)
  try {
    writeFileSync(fd, JSON.stringify({ startedAt: new Date().toISOString(), pid: process.pid }))
  } finally {
    closeSync(fd)
  }
}

function removeInstallingLock() {
  rmSync(getInstallingLockPath(), { force: true })
}

function writeInstallLock() {
  const journal = JSON.parse(readFileSync('db/migrations/meta/_journal.json', 'utf8')) as {
    entries?: Array<{ tag?: string }>
  }
  const latest = journal.entries?.at(-1)?.tag ?? 'unknown'
  const body = {
    installedAt: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
    migrationTag: latest,
  }
  writeFileSync(getInstallLockPath(), `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 })
}

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`
  return fallback
}

export function assertSameOrigin(headers: Headers) {
  const origin = headers.get('origin')
  if (!origin) return
  const host = headers.get('host')
  if (!host) throw new Error('无法校验请求来源。')
  if (new URL(origin).host !== host) throw new Error('请求来源不可信。')
}
