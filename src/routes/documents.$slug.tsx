import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ChevronRight, Clock, Edit, Eye, Hash, Info, Trash2, UserRound } from 'lucide-react'
import { useTransition } from 'react'
import { ScrollToTop } from '~/components/scroll-to-top'
import { TagPill } from '~/components/tag-pill'
import { getCurrentUser } from '~/server/auth'
import { deleteDocument, getDocumentBySlug } from '~/server/documents'

export const Route = createFileRoute('/documents/$slug')({
  loader: async ({ params }) => {
    const [document, me] = await Promise.all([
      getDocumentBySlug({ data: { slug: params.slug } }),
      getCurrentUser(),
    ])
    if (!document) throw notFound()
    return { document, me }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: 'DocBase' }] }
    const { document } = loaderData
    const description = document.excerpt ?? `${document.title} - 团队文档`
    return {
      meta: [
        { title: `${document.title} - DocBase` },
        { name: 'description', content: description },
      ],
    }
  },
  component: DocumentPage,
})

function DocumentPage() {
  const { document, me } = Route.useLoaderData()
  const isAuthor = me?.id === document.creator.id
  const headings = extractHeadings(document.contentJson)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 2xl:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          知识首页
        </Link>
        {document.space && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link
              to="/spaces/$slug"
              params={{ slug: document.space.slug }}
              className="hover:text-primary"
            >
              {document.space.name}
            </Link>
          </>
        )}
        {document.category && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span>{document.category.name}</span>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-foreground/70">{document.title}</span>
      </nav>

      <div className="flex gap-8">
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-3xl">
            <article className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
              {document.status === 'draft' && (
                <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
                  草稿，仅创建者可见
                </div>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h1 className="text-3xl font-bold leading-tight tracking-tight">{document.title}</h1>
                {isAuthor && (
                  <Link
                    to="/documents/$slug/edit"
                    params={{ slug: document.slug }}
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    编辑
                  </Link>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" />
                  {document.creator.displayName ?? document.creator.username}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <time dateTime={document.updatedAt}>
                    {new Date(document.updatedAt).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {document.viewCount} 次查看
                </span>
              </div>

              {document.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {document.tags.map((tag) => (
                    <TagPill key={tag} name={tag} />
                  ))}
                </div>
              )}

              <div
                className="prose-docbase mt-6"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: document content is sanitized server-side.
                dangerouslySetInnerHTML={{ __html: document.contentHtml }}
              />
            </article>

            {isAuthor && (
              <div className="mt-6 flex justify-end">
                <DeleteDocumentButton documentId={document.id} />
              </div>
            )}
          </div>
        </main>

        <ScrollToTop />

        <aside className="hidden w-72 shrink-0 xl:block">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                文档目录
              </div>
              {headings.length > 0 ? (
                <nav className="space-y-1">
                  {headings.map((heading, index) => (
                    <a
                      key={`${heading.text}-${index}`}
                      href={`#${heading.id}`}
                      className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                      style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }}
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
              ) : (
                <p className="text-sm text-muted-foreground">正文暂无标题结构</p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                维护信息
              </div>
              <dl className="space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">空间</dt>
                  <dd className="text-right font-medium">{document.space?.name ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">分类</dt>
                  <dd className="text-right font-medium">{document.category?.name ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">状态</dt>
                  <dd className="text-right font-medium">
                    {document.status === 'published' ? '已发布' : '草稿'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function extractHeadings(doc: unknown) {
  const headings: Array<{ id: string; level: number; text: string }> = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const item = node as {
      type?: string
      attrs?: { level?: number }
      content?: unknown[]
      text?: string
    }
    if (item.type === 'heading') {
      const text = collectText(item).trim()
      if (text) headings.push({ id: slugifyHeading(text), level: item.attrs?.level ?? 2, text })
    }
    item.content?.forEach(walk)
  }
  walk(doc)
  return headings
}

function collectText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const item = node as { text?: string; content?: unknown[] }
  return item.text ?? item.content?.map(collectText).join('') ?? ''
}

function slugifyHeading(text: string) {
  return encodeURIComponent(text.trim().toLowerCase().replace(/\s+/g, '-'))
}

function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('确认删除该文档？此操作不可撤销。')) return
        startTransition(async () => {
          try {
            await deleteDocument({ data: { id: documentId } })
            window.location.href = '/'
          } catch {
            alert('删除失败')
          }
        })
      }}
      className="inline-flex h-9 items-center gap-1 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? '删除中...' : '删除'}
    </button>
  )
}
