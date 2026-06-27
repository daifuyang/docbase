/**
 * space list
 */
import type { Command } from 'commander'
import { ApiClient } from '../api-client'
import { type OutputOpts, formatOutput } from '../output'

export function registerSpaceCommands(program: Command): void {
  program
    .command('space')
    .description('知识空间操作')
    .command('list')
    .alias('ls')
    .description('列出所有知识空间')
    .action(async () => {
      const opts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const result = await api.listSpaces()
      formatOutput(result, opts)
    })
}
