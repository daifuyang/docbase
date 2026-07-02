import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const configSchema = z.object({
  databaseUrl: z.string().min(1),
  redisUrl: z.string().min(1),
  betterAuthSecret: z.string().min(32),
  betterAuthUrl: z.string().url(),
  publicAppUrl: z.string().url(),
})

export type RuntimeConfig = z.infer<typeof configSchema>
export type DeployMode = 'development' | 'self-hosted' | 'fc'

export function getDeployMode(): DeployMode {
  const mode = process.env.DOCBASE_DEPLOY_MODE
  if (mode === 'fc' || mode === 'self-hosted' || mode === 'development') return mode
  return process.env.NODE_ENV === 'development' ? 'development' : 'self-hosted'
}

export function isFcDeployMode(): boolean {
  return getDeployMode() === 'fc'
}

export function getConfigDir(): string {
  return process.env.DOCBASE_CONFIG_DIR ?? join(process.cwd(), 'config')
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'docbase.config.json')
}

export function getInstallLockPath(): string {
  return join(getConfigDir(), 'install.lock')
}

export function getInstallingLockPath(): string {
  return join(getConfigDir(), 'installing.lock')
}

export function readRuntimeConfig(): RuntimeConfig | null {
  const path = getConfigPath()
  if (!existsSync(path)) return null
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  return configSchema.parse(parsed)
}

export function readEnvRuntimeConfig(): RuntimeConfig | null {
  const parsed = configSchema.safeParse({
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,
    betterAuthUrl: process.env.BETTER_AUTH_URL,
    publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL,
  })
  return parsed.success ? parsed.data : null
}

export function loadRuntimeConfig(): RuntimeConfig | null {
  const fileConfig = readRuntimeConfig()
  const config = fileConfig ?? readEnvRuntimeConfig()
  if (!config) return null
  if (fileConfig) {
    process.env.DATABASE_URL = config.databaseUrl
    process.env.REDIS_URL = config.redisUrl
    process.env.BETTER_AUTH_SECRET = config.betterAuthSecret
    process.env.BETTER_AUTH_URL = config.betterAuthUrl
    process.env.PUBLIC_APP_URL = config.publicAppUrl
    return config
  }
  process.env.DATABASE_URL ??= config.databaseUrl
  process.env.REDIS_URL ??= config.redisUrl
  process.env.BETTER_AUTH_SECRET ??= config.betterAuthSecret
  process.env.BETTER_AUTH_URL ??= config.betterAuthUrl
  process.env.PUBLIC_APP_URL ??= config.publicAppUrl
  return config
}

loadRuntimeConfig()
