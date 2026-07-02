import 'dotenv/config'
import Redis from 'ioredis'
import postgres from 'postgres'

const databaseUrl = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL

if (!databaseUrl) throw new Error('DATABASE_URL or MIGRATE_DATABASE_URL is required')
if (!redisUrl) throw new Error('REDIS_URL is required')

await checkDatabase(databaseUrl)
await checkRedis(redisUrl)

console.log('production preflight passed')

async function checkDatabase(url: string) {
  const parsed = parseUrl(url)
  const client = postgres(url, { max: 1, connect_timeout: 5, prepare: false })
  try {
    await client`select 1`
    console.log(`database ok: ${parsed}`)
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined)
  }
}

async function checkRedis(url: string) {
  const parsed = parseUrl(url)
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: () => null,
  })
  client.on('error', () => undefined)
  try {
    await client.connect()
    const pong = await client.ping()
    if (pong !== 'PONG') throw new Error(`unexpected Redis PING response: ${pong}`)
    console.log(`redis ok: ${parsed}`)
  } finally {
    client.disconnect()
  }
}

function parseUrl(value: string) {
  try {
    const url = new URL(value)
    const auth = url.username ? `${url.username}@` : ''
    return `${url.protocol}//${auth}${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`
  } catch {
    return '<invalid-url>'
  }
}
