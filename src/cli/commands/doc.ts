/**
 * doc create / list / get / search / update / publish / delete
 */
import { readFileSync } from 'node:fs'
import type { Command } from 'commander'
import { Errors } from '~/lib/errors'
import { createDocumentSchema, updateDocumentSchema } from '~/shared/validation/document'
import type { TipTapDoc } from '~/shared/types'
import { ApiClient } from '../api-client'
import { markdownToTiptap, parseFrontmatter } from '../markdown'
import { formatOutput, printInfo, type OutputOpts } from '../output'
import type { Frontmatter } from '../types'

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

export function registerDocCommands(program: Command): void {
  const doc = program.command('doc').description('文档操作')

  doc
    .command('create')
    .description('从 Markdown 文件或 stdin 创建文档')
    .option('-f, --from <file>', '从 Markdown 文件读取（含 frontmatter）')
    .option('--stdin', '从 stdin 读取')
    .option('--space <slugOrName>', '知识空间（slug 或名称）')
    .option('--category <slugOrName>', '分类（slug 或名称）')
    .option('--status <status>', 'draft 或 published', 'draft')
    .option('--tags <list>', '逗号分隔的标签列表')
    .action(
      async (opts: {
        from?: string
        stdin?: boolean
        space?: string
        category?: string
        status?: string
        tags?: string
      }) => {
        const globalOpts = program.opts<OutputOpts>()
        const api = new ApiClient()
        const md = await readMarkdown(opts.from, opts.stdin)
        const { data, body } = parseFrontmatter(md)

        // Resolve space slug -> id
        const spaces = (await api.listSpaces()).items
        const spaceSlug = opts.space ?? data.space
        if (!spaceSlug) throw Errors.validation('请指定 --space 或在 frontmatter 设置 space')
        const space = spaces.find((s) => s.slug === spaceSlug || s.name === spaceSlug)
        if (!space) throw Errors.notFound(`未找到知识空间：${spaceSlug}`)

        // Resolve category slug -> id (optional)
        let categoryId: string | null = null
        const categoryRef = opts.category ?? data.category
        if (categoryRef) {
          const cats = (await api.listCategories()).items.filter((c) => c.spaceId === space.id)
          const cat = cats.find((c) => c.slug === categoryRef || c.name === categoryRef)
          if (!cat) throw Errors.notFound(`未找到分类：${categoryRef}`)
          categoryId = cat.id
        }

        // Merge CLI flags over frontmatter
        const status = (opts.status ?? data.status ?? 'draft') as 'draft' | 'published'
        const tags =
          opts.tags !== undefined
            ? opts.tags.split(',').map((s) => s.trim()).filter(Boolean)
            : (data.tags ?? [])

        const tiptapDoc: TipTapDoc = markdownToTiptap(body)
        const input = createDocumentSchema.parse({
          title: data.title,
          contentJson: tiptapDoc,
          tags,
          status,
          spaceId: space.id,
          categoryId,
        })
        const result = await api.createDocument(input)
        printInfo(`Created: ${result.document.slug} (id=${result.document.id})`, globalOpts)
        formatOutput(result, globalOpts)
      },
    )

  doc
    .command('list')
    .alias('ls')
    .description('列出/搜索文档（list 与 search 等价）')
    .option('--query <q>', '搜索关键词')
    .option('--space <slug>', '按空间 slug 过滤')
    .option('--category <slug>', '按分类 slug 过滤')
    .option('--tag <slug>', '按标签 slug 过滤')
    .option('--status <status>', 'draft 或 published', 'published')
    .option('--page <n>', '页码', '1')
    .option('--page-size <n>', '每页数量', '20')
    .action(
      async (opts: {
        query?: string
        space?: string
        category?: string
        tag?: string
        status?: string
        page?: string
        pageSize?: string
      }) => {
        const globalOpts = program.opts<OutputOpts>()
        const api = new ApiClient()
        const result = await api.listDocuments({
          query: opts.query ?? '',
          spaceSlug: opts.space,
          categorySlug: opts.category,
          tagSlug: opts.tag,
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
    .option('--space <slug>', '按空间 slug 过滤')
    .option('--page <n>', '页码', '1')
    .option('--page-size <n>', '每页数量', '20')
    .action(
      async (
        query: string,
        opts: { space?: string; page?: string; pageSize?: string },
      ) => {
        const globalOpts = program.opts<OutputOpts>()
        const api = new ApiClient()
        const result = await api.listDocuments({
          query,
          spaceSlug: opts.space,
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
      const api = new ApiClient()
      const result = await api.getDocument(slug)
      formatOutput(result, opts)
    })

  doc
    .command('update <slug>')
    .description('更新文档（支持 --from/--stdin 提供 Markdown，可与 flag 并存）')
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
        const api = new ApiClient()

        // Resolve slug -> id (updateDocumentService expects uuid)
        const found = await api
          .listDocuments({ query: slug })
          .then((p) => p.items.find((d) => d.slug === slug))
        if (!found) throw Errors.notFound(`未找到 slug=${slug}`)

        let contentJson: TipTapDoc | undefined
        let title = opts.title
        let frontmatterTags: string[] | undefined
        let frontmatterStatus: 'draft' | 'published' | undefined

        if (opts.from || opts.stdin) {
          const md = await readMarkdown(opts.from, opts.stdin)
          const { data, body } = parseFrontmatter(md)
          contentJson = markdownToTiptap(body)
          title = title ?? data.title
          frontmatterTags = data.tags
          frontmatterStatus = data.status
        }

        const tags = opts.tags
          ? opts.tags.split(',').map((s) => s.trim()).filter(Boolean)
          : (frontmatterTags as string[] | undefined)

        const input = updateDocumentSchema.parse({
          id: found.id,
          title,
          contentJson,
          status: (opts.status ?? frontmatterStatus) as 'draft' | 'published' | undefined,
          tags,
        })
        const result = await api.updateDocument(input)
        printInfo(`Updated: ${result.document.slug}`, globalOpts)
        formatOutput(result, globalOpts)
      },
    )

  doc
    .command('publish <slug>')
    .description('将文档发布（设置 status=published）')
    .action(async (slug: string) => {
      const opts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const found = await api
        .listDocuments({ query: slug })
        .then((p) => p.items.find((d) => d.slug === slug))
      if (!found) throw Errors.notFound(`未找到 slug=${slug}`)
      const result = await api.updateDocument({ id: found.id, status: 'published' })
      printInfo(`Published: ${result.document.slug}`, opts)
      formatOutput(result, opts)
    })

  doc
    .command('delete <slug>')
    .description('删除文档')
    .option('--yes', '跳过确认', false)
    .action(async (slug: string, opts: { yes?: boolean }) => {
      const globalOpts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const found = await api
        .listDocuments({ query: slug })
        .then((p) => p.items.find((d) => d.slug === slug))
      if (!found) throw Errors.notFound(`未找到 slug=${slug}`)
      if (!opts.yes && process.stdin.isTTY) {
        process.stderr.write(`Delete "${found.title}" (${slug})? [y/N] `)
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
      const result = await api.deleteDocument(found.id)
      formatOutput(result, globalOpts)
    })

  // Suppress unused import warning in some setups
  void ({} as Frontmatter)
}