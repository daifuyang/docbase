/**
 * Output formatting for the CLI.
 * Honors --json (machine readable) and --no-color.
 */
import type { OutputOpts } from './types'

export type { OutputOpts }

export function formatOutput(data: unknown, opts: OutputOpts): void {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
    return
  }
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.dir(data, { depth: 8, colors: opts.color })
}

export function printInfo(message: string, opts: OutputOpts): void {
  if (opts.json) return
  process.stdout.write(`${message}\n`)
}
