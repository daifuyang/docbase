'use client'

import type { Editor } from '@tiptap/react'
import { Unlink } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { linkUrlSchema } from '~/shared/validation/document'
import { type LinkMode, getExistingLinks, getLinkMode, normalizeLinkUrl } from './link-utils'

type LinkDialogProps = {
  editor: Editor | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type LinkTarget = '_blank' | '_self'

/**
 * TinyMCE-style centred modal for inserting / editing a link.
 *
 * Replaces the old `window.prompt` and the popover-based variant. Fields:
 * URL (required, validated, normalised), display text, optional hover
 * title, and target (new window / current window). Below the target
 * dropdown, a "Link list" shows every distinct URL already used in the
 * document so users can re-pick one without retyping.
 *
 * On save:
 *  - create mode: insertContent replaces the current selection with
 *    linked text (or inserts at cursor if there's no selection);
 *  - edit mode: extendMarkRange('link') then setLink updates attrs;
 *    if the display text changed, insertContent replaces the link
 *    range with the new text (still carrying the link mark).
 */
export function LinkDialog({ editor, open, onOpenChange }: LinkDialogProps) {
  const [mode, setMode] = useState<LinkMode>({ kind: 'create', selectedText: '' })
  const [url, setUrl] = useState('')
  const [displayText, setDisplayText] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [target, setTarget] = useState<LinkTarget>('_blank')
  const [existingLinks, setExistingLinks] = useState<string[]>([])
  const [urlError, setUrlError] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Sync internal state with editor selection every time the dialog opens.
  useEffect(() => {
    if (!open || !editor) return
    const m = getLinkMode(editor)
    setMode(m)
    setUrl(m.kind === 'edit' ? m.href : '')
    setDisplayText(m.kind === 'edit' ? m.text : m.selectedText)
    setLinkTitle(m.kind === 'edit' ? (editor.getAttributes('link').title ?? '') : '')
    setTarget('_blank')
    setExistingLinks(getExistingLinks(editor))
    setUrlError(null)
    setTextError(null)
    // Focus URL input after Radix's open animation has mounted the form.
    const timer = window.setTimeout(() => urlInputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open, editor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editor) return

    const trimmedText = displayText.trim()
    if (!trimmedText) {
      setTextError('请输入显示文字')
      return
    }

    const normalized = normalizeLinkUrl(url)
    const urlResult = linkUrlSchema.safeParse(normalized)
    if (!urlResult.success) {
      setUrlError(urlResult.error.issues[0]?.message ?? '链接无效')
      urlInputRef.current?.focus()
      return
    }
    const href = urlResult.data
    const trimmedLinkTitle = linkTitle.trim()
    const attrs: { href: string; target: LinkTarget; title?: string } = { href, target }
    if (trimmedLinkTitle) attrs.title = trimmedLinkTitle

    if (mode.kind === 'edit') {
      // Update link attrs (always — covers the case where only target
      // or title changed).
      editor.chain().focus().extendMarkRange('link').setLink(attrs).run()
      // Replace text only if the user edited it.
      if (displayText !== mode.text) {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .insertContent({
            type: 'text',
            text: trimmedText,
            marks: [{ type: 'link', attrs }],
          })
          .run()
      }
    } else {
      // Create: insertContent replaces the selection (or inserts at
      // cursor when there is no selection).
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: trimmedText,
          marks: [{ type: 'link', attrs }],
        })
        .run()
    }

    onOpenChange(false)
  }

  const handleRemove = () => {
    if (!editor) return
    // extendMarkRange guarantees the unsetLink covers the entire link
    // span even when the cursor is collapsed inside it (rather than
    // only stripping the mark at the cursor position).
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onOpenChange(false)
  }

  const isEdit = mode.kind === 'edit'
  const title = isEdit ? '编辑链接' : '插入链接'
  const description = isEdit ? '修改链接地址、显示文字或打开方式。' : '为选中的文字添加超链接。'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="grid gap-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <Field label="URL" required error={urlError} inputId="link-dialog-url">
              <Input
                id="link-dialog-url"
                ref={urlInputRef}
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://example.com / mailto:… / /相对路径"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (urlError) setUrlError(null)
                }}
                aria-invalid={urlError ? 'true' : undefined}
              />
            </Field>

            <Field label="显示文字" error={textError} inputId="link-dialog-text">
              <Input
                id="link-dialog-text"
                type="text"
                placeholder="留空则使用 URL 作为文字"
                value={displayText}
                onChange={(e) => {
                  setDisplayText(e.target.value)
                  if (textError) setTextError(null)
                }}
                aria-invalid={textError ? 'true' : undefined}
              />
            </Field>

            <Field label="标题" hint="鼠标悬停时显示，可选" inputId="link-dialog-title">
              <Input
                id="link-dialog-title"
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="可选"
              />
            </Field>

            <Field label="打开方式">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as LinkTarget)}
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none"
              >
                <option value="_blank">新窗口</option>
                <option value="_self">当前窗口</option>
              </select>
            </Field>

            {existingLinks.length > 0 && (
              <Field label="从已有链接选择" inputId="link-dialog-existing">
                <select
                  id="link-dialog-existing"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) setUrl(v)
                  }}
                  className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none"
                >
                  <option value="">选择已有链接以填充 URL…</option>
                  {existingLinks.map((href) => (
                    <option key={href} value={href}>
                      {href}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <DialogFooter className="border-t border-border bg-surface-muted/40 px-6 py-3">
            <div className="flex w-full items-center justify-between gap-2">
              {mode.kind === 'edit' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  移除链接
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit" size="sm">
                  保存
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  required,
  error,
  hint,
  inputId,
  children,
}: {
  label: string
  required?: boolean
  error?: string | null
  hint?: string
  inputId?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
        {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
