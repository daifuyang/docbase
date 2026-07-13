import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, NotebookPen, Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useQuickNote } from '~/components/quick-note-provider'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { deleteQuickNote, listQuickNotes, promoteQuickNote } from '~/server/quick-notes'

export const Route = createFileRoute('/_protected/notes')({
  loader: async () => {
    const result = await listQuickNotes({ data: { limit: 100 } })
    return { notes: result.items, total: result.total }
  },
  component: NotesTimelinePage,
})

function NotesTimelinePage() {
  const navigate = useNavigate()
  const quickNote = useQuickNote()
  const { notes, total } = Route.useLoaderData()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onPromote = (id: string) => {
    setActionError(null)
    setPromotingId(id)
    startTransition(async () => {
      try {
        const result = await promoteQuickNote({ data: { id } })
        await navigate({
          to: '/documents/$slug/edit',
          params: { slug: result.document.slug },
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '升格失败'
        setActionError(message)
      } finally {
        setPromotingId(null)
      }
    })
  }

  const onConfirmDelete = () => {
    const id = pendingDeleteId
    if (!id) return
    setActionError(null)
    startTransition(async () => {
      try {
        await deleteQuickNote({ data: { id } })
        setPendingDeleteId(null)
        await navigate({ to: '/notes' })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '删除失败'
        setActionError(message)
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 2xl:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">我的小记</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {total} 条记录。仅你本人可见，升格后会变成一篇正式文档。
          </p>
        </div>
        <Button type="button" onClick={quickNote.open}>
          <Plus className="h-4 w-4" />
          新建小记
        </Button>
      </header>

      {actionError && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState onCreate={quickNote.open} />
      ) : (
        <ol className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="group rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary/40"
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {note.content}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <time dateTime={note.createdAt}>{formatRelativeTime(note.createdAt)}</time>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending && promotingId === note.id}
                    onClick={() => onPromote(note.id)}
                    title="把这条小记变成一篇正式文档草稿"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {promotingId === note.id ? '升格中…' : '升格为文档'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDeleteId(note.id)}
                    title="删除该小记"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    删除
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null)
            setActionError(null)
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1.5 px-6 pt-5 pb-4">
            <DialogTitle>删除小记</DialogTitle>
            <DialogDescription>
              删除后无法恢复。如果你之后需要，先升格为正式文档再删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-border bg-surface-muted/40 px-6 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPendingDeleteId(null)}
              disabled={pending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirmDelete}
              disabled={pending}
            >
              {pending ? '删除中…' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted/30 px-6 py-12 text-center">
      <NotebookPen className="mx-auto h-10 w-10 text-muted-foreground/60" />
      <h2 className="mt-3 text-base font-medium">还没有小记</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        顶部 <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs">⌘</kbd>{' '}
        + <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs">Shift</kbd>{' '}
        + <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs">N</kbd>{' '}
        随时唤起，记录一闪而过的想法。
      </p>
      <Button type="button" className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        写第一条小记
      </Button>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  if (Number.isNaN(diffMs)) return iso
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
