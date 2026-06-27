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

export function buildProgram(): Command {
  const program = new Command()
  program
    .name('docbase')
    .description('DocBase CLI — 命令行访问企业知识库')
    .version(readPackageVersion())
    .option('--json', '以 JSON 格式输出', false)
    .option('--no-color', '禁用 ANSI 颜色')
    .option('-v, --verbose', '详细日志输出', false)
    .configureOutput({
      writeErr: (str) => process.stderr.write(str),
    })

  registerCommands(program)

  // Default error handler at the Commander level
  program.exitOverride()

  return program
}

export type { OutputOpts }