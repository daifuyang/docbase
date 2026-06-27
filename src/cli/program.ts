import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { registerCommands } from './commands'
import type { OutputOpts } from './types'

function readPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    // In dev (tsx) the file is at src/cli/program.ts; in production
    // it's bundled and the package.json is two levels up.
    const candidates = [
      resolve(here, '../../package.json'),
      resolve(here, '../../../package.json'),
      resolve(process.cwd(), 'package.json'),
    ]
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf8')) as { name: string; version: string }
        if (pkg.name === 'docbase') return pkg.version
      } catch {
        // continue
      }
    }
  } catch {
    // ignore
  }
  return '0.0.0'
}

export type GlobalOpts = OutputOpts & {
  server?: string
}

export function buildProgram(): Command {
  const program = new Command()
  program
    .name('docbase')
    .description('DocBase CLI — 命令行访问企业知识库')
    .version(readPackageVersion())
    .option('--json', '以 JSON 格式输出', false)
    .option('--no-color', '禁用 ANSI 颜色')
    .option('-v, --verbose', '详细日志输出', false)
    .option(
      '--server <url>',
      '走 HTTP 模式调用远端 DocBase server；省略时走本地 in-process 路径（需要源码 + .env）',
    )
    .configureOutput({
      writeErr: (str) => process.stderr.write(str),
    })

  registerCommands(program)

  // Default error handler at the Commander level
  program.exitOverride()

  // After parsing, propagate --server into process.env so `ApiClient`
  // (constructed deep in command handlers) can pick it up without
  // having to thread the option through every constructor.
  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts<GlobalOpts>()
    if (opts.server) process.env.DOCBASE_SERVER = opts.server
  })

  return program
}

/**
 * Resolve the effective server URL:
 *   --server <url>  >  $DOCBASE_SERVER  >  undefined (fall back to in-process)
 *
 * Strips a trailing slash so we can safely concatenate `'/api/v1/...'` later.
 */
export function resolveServerUrl(opts: { server?: string }): string | undefined {
  const raw = opts.server ?? process.env.DOCBASE_SERVER
  if (!raw) return undefined
  return raw.replace(/\/+$/, '')
}

export type { OutputOpts }