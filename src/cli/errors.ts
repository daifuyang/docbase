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
        break
      case 401:
        process.exit(4)
        break
      case 403:
        process.exit(5)
        break
      case 429:
        process.exit(6)
        break
      default:
        process.exit(1)
        break
    }
  }
  if (err instanceof Error) {
    process.stderr.write(`error: ${err.message}\n`)
    if (err.cause) {
      process.stderr.write(
        `cause: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}\n`,
      )
    }
    process.exit(1)
  }
  process.stderr.write('error: unknown\n')
  process.exit(3)
}
