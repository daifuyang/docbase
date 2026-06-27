import Redis from 'ioredis'

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
