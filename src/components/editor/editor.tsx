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
  Quote,
  SquareCode,
} from 'lucide-react'
import { useEffect } from 'react'
import type { TipTapDoc } from '~/shared/types'

type Props = {
  value: TipTapDoc
  onChange: (value: TipTapDoc) => void
  placeholder?: string
}

export function Editor({ value, onChange, placeholder }: Props) {
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
        'data-placeholder': placeholder ?? '开始写作…',
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getJSON() as TipTapDoc)
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="rounded-md border border-input bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null
  const btn = (active: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-md text-sm hover:bg-accent ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`
  return (
    <div className="flex flex-wrap gap-1 border-b border-border p-2">
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
        onClick={() => {
          const url = window.prompt('链接 URL：')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        className={btn(editor.isActive('link'))}
      >
        <LinkIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
