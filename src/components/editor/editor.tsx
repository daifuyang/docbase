'use client'

import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Quote,
  SquareCode,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '~/lib/utils'
import type { TipTapDoc } from '~/shared/types'
import { LinkDialog } from './link-dialog'

type Props = {
  value: TipTapDoc
  onChange: (value: TipTapDoc) => void
  placeholder?: string
}

export function Editor({ value, onChange, placeholder }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [isEmpty, setIsEmpty] = useState(
    () => !value || !value.content || value.content.length === 0,
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'language-plain' } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none',
      },
    },
    onCreate({ editor }) {
      setIsEmpty(editor.isEmpty)
    },
    onUpdate({ editor }) {
      onChange(editor.getJSON() as TipTapDoc)
      setIsEmpty(editor.isEmpty)
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  // Esc exits fullscreen — but if the link modal is open, let it close
  // first so a single Escape only dismisses one thing at a time.
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (linkOpen) return
      setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen, linkOpen])

  // Lock background scroll while fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }
  }, [isFullscreen])

  if (!editor) return null

  return (
    <div
      className={cn(
        'relative rounded-md border border-input bg-surface transition-colors focus-within:border-primary',
        isFullscreen &&
          'editor-fullscreen fixed inset-0 z-50 flex flex-col rounded-none border-0 bg-surface shadow-2xl',
      )}
    >
      <Toolbar
        editor={editor}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((v) => !v)}
        onOpenLink={() => setLinkOpen(true)}
      />
      <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
      <div className={cn(isFullscreen && 'flex-1 overflow-y-auto')}>
        <EditorContent editor={editor} />
      </div>
      {isEmpty && (
        <div
          role="presentation"
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-4"
        >
          <span className="text-sm italic text-muted-foreground/55">
            {placeholder ?? '开始写作…'}
          </span>
        </div>
      )}
    </div>
  )
}

function Toolbar({
  editor,
  isFullscreen,
  onToggleFullscreen,
  onOpenLink,
}: {
  editor: ReturnType<typeof useEditor>
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenLink: () => void
}) {
  if (!editor) return null
  const btn = (active: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-md text-sm hover:bg-accent ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`
  return (
    <div className="border-b border-border p-2">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          title="加粗"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive('bold'))}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="斜体"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive('italic'))}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="行内代码"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={btn(editor.isActive('code'))}
        >
          <Code className="h-4 w-4" />
        </button>
        <span className="mx-1 w-px self-stretch bg-border" />
        <button
          type="button"
          title="一级标题"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btn(editor.isActive('heading', { level: 1 }))}
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="二级标题"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive('heading', { level: 2 }))}
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="三级标题"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btn(editor.isActive('heading', { level: 3 }))}
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <span className="mx-1 w-px self-stretch bg-border" />
        <button
          type="button"
          title="无序列表"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive('bulletList'))}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="有序列表"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive('orderedList'))}
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="引用"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btn(editor.isActive('blockquote'))}
        >
          <Quote className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="代码块"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={btn(editor.isActive('codeBlock'))}
        >
          <SquareCode className="h-4 w-4" />
        </button>
        <span className="mx-1 w-px self-stretch bg-border" />
        <button
          type="button"
          title="链接"
          onClick={onOpenLink}
          className={btn(editor.isActive('link'))}
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            title={isFullscreen ? '退出全屏' : '全屏'}
            onClick={onToggleFullscreen}
            className={btn(false)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
