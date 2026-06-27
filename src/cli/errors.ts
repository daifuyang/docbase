/**
 * Top-level error handler for the CLI.
 * Maps ServerError codes to process exit codes.
 */
import { isServerError } from '~/lib/errors'

export function handleError(err: unknown): never {
  if (isServerError(err)) {
    process.stderr.write(`error [${err.code}]: ${err.message}\n`)
    if (err.code === 'RATE_LIMITED' && err.details && typeof err.details === 'object') {
      const resetAt = (err.details as { resetAt?: number }).resetAt
      if (resetAt) {
        process.stderr.write(`retry after ${new Date(resetAt * 1000).toISOString()}\n`)
      }
    }
    switch (err.statusCode) {
      case 400:
        process.exit(2)
      case 401:
        process.exit(4)
      case 403:
        process.exit(5)
      case 429:
        process.exit(6)
      default:
        process.exit(1)
    }
  }
  if (err instanceof Error) {
    process.stderr.write(`error: ${err.message}\n`)
    process.exit(1)
  }
  process.stderr.write('error: unknown\n')
  process.exit(3)
}