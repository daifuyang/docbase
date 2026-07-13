import { Link, createFileRoute } from '@tanstack/react-router'
import { FileText, FolderOpen, NotebookPen, PenLine, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { DocumentCard } from '~/components/document-card'
import { Badge } from '~/components/ui/badge'
import { listDocuments, listMyDocuments } from '~/server/documents'
import { listQuickNotes } from '~/server/quick-notes'
import { listSpaceTree } from '~/server/spaces'
import { listTags } from '~/server/tags'

export const Route = createFileRoute('/_protected/')({
  staleTime: 0,
  shouldReload: true,
  loader: async () => {
    const [documents, drafts, spaces, tags, quickNotesResult] = await Promise.all([
      listDocuments({ data: { page: 1, pageSize: 12 } }),
      listMyDocuments({ data: { status: 'draft', page: 1, pageSize: 5 } }),
      listSpaceTree(),
      listTags({ data: { limit: 12 } }),
      listQuickNotes({ data: { limit: 5 } }),
    ])
    const draftItems = drafts.items.filter((document) => document.status === 'draft')
    const draftIds = new Set(draftItems.map((document) => document.id))
    const publishedItems = documents.items.filter(
      (document) => document.status === 'published' && !draftIds.has(document.id),
    )

    return {
      documents: publishedItems,
      drafts: draftItems,
      spaces: spaces.items,
      total: documents.total,
      tags: tags.items,
      quickNotes: quickNotesResult.items,
      quickNotesTotal: quickNotesResult.total,
    }
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
  }),
  component: HomePage,
})

function HomePage() {
  const { documents, drafts, spaces, total, tags, quickNotes, quickNotesTotal } =
    Route.useLoaderData()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 2xl:px-8">
      <header className="mb-5 border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">知识库工作台</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatHomeSummary(total, spaces.length)}。优先处理草稿、维护空间，再查阅最近更新。
            </p>
          </div>
          <Link
            to="/documents/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            新建文档
          </Link>
        </div>
      </header>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label="已发布文档" value={total} icon={<FileText className="h-4 w-4" />} />
        <MetricCard
          label="知识空间"
          value={spaces.length}
          icon={<FolderOpen className="h-4 w-4" />}
        />
        <MetricCard label="我的草稿" value={drafts.length} icon={<PenLine className="h-4 w-4" />} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-5">
          {drafts.length > 0 && (
            <section>
              <SectionTitle title="我的草稿" meta="待完善后发布" />
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                {drafts.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </div>
            </section>
          )}

          {quickNotes.length > 0 && (
            <section>
              <SectionTitle title="最近小记" meta={`${quickNotesTotal} 条`} />
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                {quickNotes.map((note) => (
                  <QuickNoteRow key={note.id} note={note} />
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle title="最近更新" meta={`${total} 篇文档`} />
            {documents.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                {documents.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-5">
          <section>
            <SectionTitle title="知识空间" meta={`${spaces.length} 个空间`} />
            <div className="space-y-2">
              {spaces.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
                  暂无空间，请管理员先建立知识结构
                </div>
              ) : (
                spaces.slice(0, 8).map((space) => (
                  <Link
                    key={space.id}
                    to="/spaces/$slug"
                    params={{ slug: space.slug }}
                    className="block rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-primary/40 hover:bg-surface-muted"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1 truncate text-sm font-medium">
                        {space.name}
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {countSpaceDocuments(space)}
                      </span>
                    </div>
                    {space.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {space.description}
                      </p>
                    )}
                  </Link>
                ))
              )}
            </div>
          </section>

          {tags.length > 0 && (
            <section>
              <SectionTitle title="热门标签" meta={`${tags.length} 个`} />
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 12).map((tag) => (
                    <Badge key={tag.slug} variant="secondary" className="font-normal">
                      <Link to="/tags/$slug" params={{ slug: tag.slug }}>
                        #{tag.name}
                      </Link>
                    </Badge>
                  ))}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  )
}

function SectionTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground">{meta}</span>
    </div>
  )
}

function formatHomeSummary(total: number, spaceCount: number) {
  if (spaceCount === 0) return `共 ${total} 篇文档`
  return `${spaceCount} 个知识空间，${total} 篇已发布文档`
}

function countSpaceDocuments(space: {
  documents: unknown[]
  categories: Array<{ documents: unknown[] }>
}) {
  return (
    space.documents.length + space.categories.reduce((sum, item) => sum + item.documents.length, 0)
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-8 py-16 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <FileText className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold">还没有内部文档</h2>
      <p className="mt-1 text-sm text-muted-foreground">先沉淀一篇制度、复盘或项目说明</p>
      <Link
        to="/documents/new"
        className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        新建文档
      </Link>
    </div>
  )
}

type QuickNoteRowProps = {
  note: { id: string; content: string; createdAt: string }
}

function QuickNoteRow({ note }: QuickNoteRowProps) {
  return (
    <Link
      to="/notes"
      className="group block border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-muted/70"
    >
      <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-foreground group-hover:text-primary">
        {note.content}
      </p>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        <NotebookPen className="h-3 w-3" />
        <time dateTime={note.createdAt}>{formatRelativeDate(note.createdAt)}</time>
      </div>
    </Link>
  )
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}
