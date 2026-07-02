import { AsyncLocalStorage } from 'node:async_hooks'
import pino from 'pino'

type LogContext = {
  requestId?: string
  userId?: string
  route?: string
}

const storage = new AsyncLocalStorage<LogContext>()

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'docbase' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  mixin() {
    const ctx = storage.getStore()
    return ctx ?? {}
  },
})
