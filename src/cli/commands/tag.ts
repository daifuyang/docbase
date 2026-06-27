/**
 * tag list
 */
import type { Command } from 'commander'
import { ApiClient } from '../api-client'
import { type OutputOpts, formatOutput } from '../output'

export function registerTagCommands(program: Command): void {
  program
    .command('tag')
    .description('标签操作')
    .command('list')
    .alias('ls')
    .description('列出所有标签')
    .option('--limit <n>', '最多返回数量', '100')
    .action(async (opts: { limit?: string }) => {
      const globalOpts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const limit = opts.limit ? Number.parseInt(opts.limit, 10) : undefined
      const result = await api.listTags(limit)
      formatOutput(result, globalOpts)
    })
}
