import { Link, Outlet, createFileRoute, notFound, useLocation } from '@tanstack/react-router'
import { ChevronRight, Clock, Edit, Eye, Hash, Info, Trash2, UserRound } from 'lucide-react'
import { useState, useTransition } from 'react'
import { TagPill } from '~/components/tag-pill'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { deleteDocument, getDocumentBySlug } from '~/server/documents'

export const Route = createFileRoute('/_protected/documents/$slug')({
  loader: async ({ params }) => {
    const document = await getDocumentBySlug({ data: { slug: params.slug } })
    if (!document) throw notFound()
    return { document }
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
  const { document } = Route.useLoaderData()
  const { me } = Route.useRouteContext()
  const isAuthor = me?.id === document.creator.id
  const headings = extractHeadings(document.contentJson)
  const location = useLocation()

  // 命中 /documents/$slug/edit 子路由时，仅渲染子路由（避免 detail 内容与编辑表单同时显示）
  if (location.pathname.endsWith('/edit')) {
    return <Outlet />
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 2xl:px-8">
      <div className="flex w-full gap-8">
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-3xl">
            <nav className="flex min-w-0 flex-wrap items-center gap-1.5 pb-5 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary">
                知识首页
              </Link>
              {document.space && (
                <>
                  <ChevronRight className="h-3 w-3 shrink-0" />
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
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span>{document.category.name}</span>
                </>
              )}
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate text-foreground/70">{document.title}</span>
            </nav>
            <article className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
              {document.status === 'draft' && (
                <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
                  草稿，仅创建者可见
                </div>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h1 className="text-3xl font-bold leading-tight tracking-tight">
                  {document.title}
                </h1>
                {isAuthor && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to="/documents/$slug/edit"
                      params={{ slug: document.slug }}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      编辑
                    </Link>
                    <DeleteDocumentButton documentId={document.id} />
                  </div>
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
          </div>
        </main>

        <aside className="hidden w-72 shrink-0 pt-10 xl:block">
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const runDelete = () => {
    startTransition(async () => {
      try {
        await deleteDocument({ data: { id: documentId } })
        window.location.href = '/'
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : null)
        setErrorOpen(true)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? '删除中...' : '删除'}
      </button>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // Don't allow dismissing the confirmation while the delete is
          // already running — closes the window where Esc would race the
          // network request and leave the user looking at a half-deleted
          // document.
          if (!open && pending) return
          setConfirmOpen(open)
        }}
      >
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1.5 px-6 pt-5 pb-4">
            <DialogTitle>删除文档</DialogTitle>
            <DialogDescription>确认删除该文档？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-border bg-surface-muted/40 px-6 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false)
                runDelete()
              }}
            >
              {pending ? '删除中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={errorOpen}
        onOpenChange={(open) => {
          setErrorOpen(open)
          if (!open) setErrorMessage(null)
        }}
      >
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1.5 px-6 pt-5 pb-4">
            <DialogTitle>删除失败</DialogTitle>
            <DialogDescription>
              {errorMessage ?? '请稍后重试，或联系管理员。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-border bg-surface-muted/40 px-6 py-3">
            <Button type="button" size="sm" onClick={() => setErrorOpen(false)}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
