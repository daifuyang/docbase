'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Loader2, NotebookPen } from 'lucide-react'
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { createQuickNote } from '~/server/quick-notes'

type QuickNoteDialogProps = {
  open: boolean
  onOpenChange: (next: boolean) => void
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; savedAt: number }
  | { kind: 'error'; message: string }

const SAVE_DEBOUNCE_MS = 600

export function QuickNoteDialog({ open, onOpenChange }: QuickNoteDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Reset whenever the dialog closes so the next open starts blank.
  useEffect(() => {
    if (!open) {
      setContent('')
      setState({ kind: 'idle' })
    }
  }, [open])

  // Auto-focus the textarea when the dialog mounts (post-animation frame so
  // Radix has finished transitioning before we steal focus).
  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => textareaRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  const submitNow = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      if (trimmed === '') {
        onOpenChange(false)
        return
      }
      setState({ kind: 'saving' })
      startTransition(async () => {
        try {
          await createQuickNote({ data: { content: trimmed } })
          setState({ kind: 'saved', savedAt: Date.now() })
          // The /notes timeline reads through React Query; invalidate so the
          // next visit reflects the new note immediately.
          queryClient.invalidateQueries({ queryKey: ['quickNotes'] }).catch(() => {})
          router.invalidate().catch(() => {})
          onOpenChange(false)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '保存失败，请稍后再试'
          setState({ kind: 'error', message })
        }
      })
    },
    [onOpenChange, queryClient, router],
  )

  // Debounced autosave — fires 600ms after the user stops typing. The point
  // of autosave is to capture flash thoughts even if the user navigates
  // away; the explicit Enter / 保存 button shortcut exists for those who
  // want to lock the entry in immediately.
  useEffect(() => {
    if (!open) return
    const value = content.trim()
    if (value === '') return
    const timer = window.setTimeout(() => {
      submitNow(content)
    }, SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [content, open, submitNow])

  const onTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value)
    if (state.kind === 'error') setState({ kind: 'idle' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter saves; Shift+Enter inserts a newline (the common journaling
    // gesture). Cmd/Ctrl+Enter also saves as a power-user shortcut.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submitNow(content)
    }
  }

  const charCount = content.length
  const isSaving = pending || state.kind === 'saving'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1.5 px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-primary" />
            快速记录
          </DialogTitle>
          <DialogDescription>
            想法、灵感、待办、会议要点——写下来就好。Enter 保存，Shift+Enter 换行。
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={onTextareaChange}
            onKeyDown={onKeyDown}
            placeholder="此刻在想什么？"
            rows={5}
            disabled={isSaving}
            className="block min-h-[120px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 disabled:opacity-60"
            maxLength={4000}
          />
        </div>
        <DialogFooter className="flex flex-col gap-2 border-t border-border bg-surface-muted/40 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {state.kind === 'saved' && <span aria-live="polite">已保存到「我的小记」</span>}
            {state.kind === 'saving' && (
              <span aria-live="polite" className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                保存中…
              </span>
            )}
            {state.kind === 'error' && (
              <span aria-live="polite" className="text-destructive">
                {state.message}
              </span>
            )}
            {state.kind === 'idle' && <span>仅本人可见</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">{charCount} / 4000</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => submitNow(content)}
              disabled={isSaving || content.trim() === ''}
            >
              {isSaving ? '保存中…' : '保存'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
