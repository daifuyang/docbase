/**
 * Spawn the CLI as a child process and capture its output.
 * Tests use this to exercise the actual CLI binary end-to-end.
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

export type CliResult = {
  code: number
  stdout: string
  stderr: string
}

export function runCli(args: string[], env: Record<string, string> = {}): Promise<CliResult> {
  return new Promise((res, rej) => {
    const cli = spawn(
      'node',
      ['--import', 'tsx', resolve(__dirname, '../../src/cli/index.ts'), ...args],
      {
        cwd: resolve(__dirname, '../..'),
        env: { ...process.env, ...env, NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stdout = ''
    let stderr = ''
    cli.stdout.on('data', (b: Buffer) => {
      stdout += b.toString()
    })
    cli.stderr.on('data', (b: Buffer) => {
      stderr += b.toString()
    })
    cli.on('error', rej)
    cli.on('close', (code) => {
      res({ code: code ?? -1, stdout, stderr })
    })
  })
}
