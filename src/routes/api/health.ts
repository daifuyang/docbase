import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import { ensureRedis, REDIS_PREFIX, redis } from '~/lib/redis.server'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const [dbOk, redisOk] = await Promise.all([
          db
            .execute(sql`select 1`)
            .then(() => true)
            .catch(() => false),
          ensureRedis()
            .then(() =>
              redis
                .ping()
                .then((r) => r === 'PONG')
                .catch(() => false),
            )
            .catch(() => false),
        ])

        const body = {
          ok: dbOk && redisOk,
          version: process.env.npm_package_version ?? '0.0.0',
          db: dbOk ? 'up' : 'down',
          redis: redisOk ? 'up' : 'down',
          redisKeyPrefix: REDIS_PREFIX,
          ts: new Date().toISOString(),
        }
        return new Response(JSON.stringify(body), {
          status: body.ok ? 200 : 503,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      },
    },
  },
})
