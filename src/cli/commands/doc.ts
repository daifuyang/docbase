/**
 * doc create / list / search / get / update / publish / delete
 *
 * HTTP-only — operates on the DocBase server via /api/v1/cli/documents.
 */
import { readFileSync } from 'node:fs'
import type { Command } from 'commander'
import { Errors } from '~/lib/errors'
import { makeApiClient } from '../api-client'
import { formatOutput, printInfo, type OutputOpts } from '../output'

async function readMarkdown(fromFile?: string, fromStdin?: boolean): Promise<string> {
  if (fromStdin) {
    return await new Promise<string>((resolve, reject) => {
      let buf = ''
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (chunk: string) => (buf += chunk))
      process.stdin.on('end', () => resolve(buf))
      process.stdin.on('error', reject)
    })
  }
  if (fromFile) {
    return readFileSync(fromFile, 'utf8')
  }
  throw Errors.validation('请提供 --from <file> 或 --stdin')
}

/** Extract simple frontmatter (title, status, tags) from a Markdown file. */
function parseFrontmatter(md: string): { data: Record<string, unknown>; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { data: {}, body: md }
  const yamlBlock = m[1] ?? ''
  const body = m[2] ?? ''
  const data: Record<string, unknown> = {}
  for (const line of yamlBlock.split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.+)$/)
    if (!kv) continue
    const key = kv[1] ?? ''
    let val: unknown = (kv[2] ?? '').trim()
    if (val === 'true') val = true
    else if (val === 'false') val = false
    data[key] = val
  }
  return { data, body }
}

export function registerDocCommands(program: Command): void {
  const doc = program.command('doc').description('文档操作')

  doc
    .command('create')
    .description('从 Markdown 文件或 stdin 创建文档')
    .option('-f, --from <file>', '从 Markdown 文件读取（含 frontmatter）')
    .option('--stdin', '从 stdin 读取')
    .option('--space <id>', '目标空间 ID（必填，HTTP 创建需要 UUID）')
    .option('--category <id>', '分类 ID（可选）')
    .option('--status <status>', 'draft 或 published', 'draft')
    .option('--tags <list>', '逗号分隔的标签列表')
    .option('--title <title>', '文档标题（也可写在 frontmatter）')
    .action(
      async (opts: {
        from?: string
        stdin?: boolean
        space?: string
        category?: string
        status?: string
        tags?: string
        title?: string
      }) => {
        const globalOpts = program.opts<OutputOpts>()
        const api = makeApiClient(program)
        const md = await readMarkdown(opts.from, opts.stdin)
        const { data, body } = parseFrontmatter(md)

        const title = (opts.title ?? (data.title as string | undefined))?.trim()
        if (!title) throw Errors.validation('请提供 --title 或在 frontmatter 设置 title')
        const spaceId = opts.space ?? (data.space as string | undefined)
        if (!spaceId) throw Errors.validation('请提供 --space <uuid>')

        const status = (opts.status ?? (data.status as string | undefined) ?? 'draft') as
          | 'draft'
          | 'published'
        const tags = (
          opts.tags
            ? opts.tags.split(',').map((s) => s.trim()).filter(Boolean)
            : (data.tags as string[] | undefined) ?? []
        ) as string[]

        const result = await api.createDocument({
          title,
          contentMarkdown: body,
          spaceId,
          categoryId: opts.category,
          status,
          tags,
        })
        printInfo(`Created: ${result.document.slug} (id=${result.document.id})`, globalOpts)
        formatOutput(result, globalOpts)
      },
    )

  doc
    .command('list')
    .alias('ls')
    .description('列出/搜索文档')
    .option('--query <q>', '搜索关键词')
    .option('--status <status>', 'draft 或 published', 'published')
    .option('--page <n>', '页码', '1')
    .option('--page-size <n>', '每页数量', '20')
    .action(
      async (opts: {
        query?: string
        status?: string
        page?: string
        pageSize?: string
      }) => {
        const globalOpts = program.opts<OutputOpts>()
        const api = makeApiClient(program)
        const result = await api.listDocuments({
          query: opts.query ?? '',
          status: (opts.status ?? 'published') as 'draft' | 'published',
          page: opts.page ? Number.parseInt(opts.page, 10) : 1,
          pageSize: opts.pageSize ? Number.parseInt(opts.pageSize, 10) : 20,
        })
        formatOutput(result, globalOpts)
      },
    )

  doc
    .command('search <query>')
    .description('按关键词搜索文档（与 `doc list --query` 等价）')
    .option('--page <n>', '页码', '1')
    .option('--page-size <n>', '每页数量', '20')
    .action(
      async (
        query: string,
        opts: { page?: string; pageSize?: string },
      ) => {
        const globalOpts = program.opts<OutputOpts>()
        const api = makeApiClient(program)
        const result = await api.listDocuments({
          query,
          page: opts.page ? Number.parseInt(opts.page, 10) : 1,
          pageSize: opts.pageSize ? Number.parseInt(opts.pageSize, 10) : 20,
        })
        formatOutput(result, globalOpts)
      },
    )

  doc
    .command('get <slug>')
    .description('获取文档详情（含 contentHtml）')
    .action(async (slug: string) => {
      const opts = program.opts<OutputOpts>()
      const api = makeApiClient(program)
      const result = await api.getDocument(slug)
      formatOutput(result, opts)
    })

  doc
    .command('update <slug>')
    .description('更新文档（支持 --from/--stdin 提供 Markdown）')
    .option('-f, --from <file>', '从 Markdown 文件读取')
    .option('--stdin', '从 stdin 读取')
    .option('--title <title>', '新标题')
    .option('--status <status>', 'draft 或 published')
    .option('--tags <list>', '逗号分隔的标签列表')
    .action(
      async (
        slug: string,
        opts: {
          from?: string
          stdin?: boolean
          title?: string
          status?: string
          tags?: string
        },
      ) => {
        const globalOpts = program.opts<OutputOpts>()
        const api = makeApiClient(program)
        const update: {
          title?: string
          contentMarkdown?: string
          status?: 'draft' | 'published'
          tags?: string[]
        } = {}
        if (opts.title) update.title = opts.title
        if (opts.status) update.status = opts.status as 'draft' | 'published'
        if (opts.tags)
          update.tags = opts.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        if (opts.from || opts.stdin) {
          const md = await readMarkdown(opts.from, opts.stdin)
          const { data, body } = parseFrontmatter(md)
          update.contentMarkdown = body
          if (!opts.title && typeof data.title === 'string') update.title = data.title
        }
        const result = await api.updateDocument(slug, update)
        printInfo(`Updated: ${slug}`, globalOpts)
        formatOutput(result, globalOpts)
      },
    )

  doc
    .command('publish <slug>')
    .description('将文档发布（设置 status=published）')
    .action(async (slug: string) => {
      const opts = program.opts<OutputOpts>()
      const api = makeApiClient(program)
      const result = await api.updateDocument(slug, { status: 'published' })
      printInfo(`Published: ${slug}`, opts)
      formatOutput(result, opts)
    })

  doc
    .command('delete <slug>')
    .description('删除文档')
    .option('--yes', '跳过确认', false)
    .action(async (slug: string, opts: { yes?: boolean }) => {
      const globalOpts = program.opts<OutputOpts>()
      if (!opts.yes && process.stdin.isTTY) {
        process.stderr.write(`Delete "${slug}"? [y/N] `)
        const answer = await new Promise<string>((resolve) => {
          const onData = (ch: Buffer) => {
            process.stdin.removeListener('data', onData)
            resolve(ch.toString('utf8').trim())
          }
          process.stdin.resume()
          process.stdin.once('data', onData)
        })
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          printInfo('Aborted.', globalOpts)
          return
        }
      }
      const api = makeApiClient(program)
      await api.deleteDocument(slug)
      printInfo(`Deleted: ${slug}`, globalOpts)
    })
}
