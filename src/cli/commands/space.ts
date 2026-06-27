/**
 * space list / create / create-category
 */
import type { Command } from 'commander'
import { ApiClient } from '../api-client'
import { formatOutput, printInfo, type OutputOpts } from '../output'

export function registerSpaceCommands(program: Command): void {
  const space = program.command('space').description('知识空间操作')

  space
    .command('list')
    .alias('ls')
    .description('列出所有知识空间')
    .action(async () => {
      const opts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const result = await api.listSpaces()
      formatOutput(result, opts)
    })

  space
    .command('create')
    .description('创建知识空间（需 admin）')
    .requiredOption('--name <name>', '空间名称')
    .option('--description <text>', '空间描述')
    .action(async (opts: { name: string; description?: string }) => {
      const globalOpts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const result = await api.createSpace({
        name: opts.name,
        description: opts.description,
      })
      printInfo(`Created space: ${result.space.slug} (id=${result.space.id})`, globalOpts)
      formatOutput(result, globalOpts)
    })

  space
    .command('create-category')
    .description('在指定空间下创建分类（需 admin）')
    .requiredOption('--space <slugOrName>', '所属空间（slug 或名称）')
    .requiredOption('--name <name>', '分类名称')
    .option('--description <text>', '分类描述')
    .action(async (opts: { space: string; name: string; description?: string }) => {
      const globalOpts = program.opts<OutputOpts>()
      const api = new ApiClient()

      const spaces = (await api.listSpaces()).items
      const space = spaces.find((s) => s.slug === opts.space || s.name === opts.space)
      if (!space) {
        throw new Error(`未找到知识空间：${opts.space}`)
      }

      const result = await api.createCategory({
        spaceId: space.id,
        name: opts.name,
        description: opts.description,
      })
      printInfo(
        `Created category: ${result.category.slug} (space=${space.slug})`,
        globalOpts,
      )
      formatOutput(result, globalOpts)
    })
}
