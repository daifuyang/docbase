/**
 * tag list / create
 */
import type { Command } from 'commander'
import { ApiClient } from '../api-client'
import { formatOutput, printInfo, type OutputOpts } from '../output'

export function registerTagCommands(program: Command): void {
  const tag = program.command('tag').description('标签操作')

  tag
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

  tag
    .command('create')
    .description('创建标签（需 admin；同名则幂等返回已有）')
    .requiredOption('--name <name>', '标签名')
    .action(async (opts: { name: string }) => {
      const globalOpts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const result = await api.createTag({ name: opts.name })
      printInfo(`Tag: ${result.tag.slug} (id=${result.tag.id})`, globalOpts)
      formatOutput(result, globalOpts)
    })
}
