import Redis from 'ioredis'
import './runtime-config.server'

/**
 * 所有 Redis key 必须加 REDIS_PREFIX 前缀，使 ECS Redis ACL
 * (`~docbase:*` keyspace 隔离) 真正生效；同时让多项目合用一个
 * Redis 时，docbase 的 key 不会越界。
 */
export const REDIS_PREFIX = 'docbase:'

const url = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Single shared client (lazy connect)
export const redis = new Redis(url, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    if (times > 5) return null
    return Math.min(times * 200, 2000)
  },
})

redis.on('error', (err) => {
  console.error('[redis] error:', err.message)
})

export async function ensureRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') return
  try {
    await redis.connect()
  } catch (_err) {
    // ignore — calls will fail and caller decides what to do
  }
}

/**
 * 拼出带 prefix 的 key。所有写读一律调用此函数。
 */
export function withPrefix(key: string): string {
  return key.startsWith(REDIS_PREFIX) ? key : `${REDIS_PREFIX}${key}`
}
