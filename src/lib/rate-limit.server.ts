import { logger } from './logger.server'
import { ensureRedis, redis } from './redis.server'

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Fixed-window rate limiter backed by Redis INCR + EXPIRE.
 *
 * @param scope   Logical scope name, e.g. 'auth:login'
 * @param key     Per-caller key, e.g. IP or userId
 * @param limit   Max events in the window
 * @param windowSec Window length in seconds
 */
export async function rateLimit(
  scope: string,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  await ensureRedis()
  const fullKey = `rl:${scope}:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`
  try {
    const count = await redis.incr(fullKey)
    if (count === 1) {
      await redis.expire(fullKey, windowSec)
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: (Math.floor(Date.now() / 1000 / windowSec) + 1) * windowSec,
    }
  } catch (err) {
    // Fail open on Redis error — better to serve than to hard-fail
    logger.warn({ err, scope, key }, 'rateLimit failed; allowing request')
    return { allowed: true, remaining: limit, resetAt: 0 }
  }
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
