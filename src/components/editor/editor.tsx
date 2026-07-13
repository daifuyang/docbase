'use client'

import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
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
  Table as TableIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ColumnAgg, DataFormat, DataType, RowKind } from '~/lib/table-aggregate'
import { cn } from '~/lib/utils'
import type { TipTapDoc } from '~/shared/types'
import { LinkDialog } from './link-dialog'
import {
  TableAggregateCommands,
  TableCellAggregate,
  TableHeaderAggregate,
  TableRowAggregate,
} from './table-aggregate-attrs'
import { TableDialog } from './table-dialog'

type Props = {
  value: TipTapDoc
  onChange: (value: TipTapDoc) => void
  placeholder?: string
}

export function Editor({ value, onChange, placeholder }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
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
      Table.configure({ resizable: false, HTMLAttributes: { class: 'doc-table' } }),
      TableRowAggregate,
      TableHeaderAggregate,
      TableCellAggregate,
      TableAggregateCommands,
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
      if (tableOpen) return
      setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen, linkOpen, tableOpen])

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
        onOpenTable={() => setTableOpen(true)}
      />
      <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
      <TableDialog editor={editor} open={tableOpen} onOpenChange={setTableOpen} />
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

const ROW_KIND_OPTIONS: Array<{ value: RowKind; label: string; hint: string }> = [
  { value: 'data', label: '数据行', hint: '普通的明细数据' },
  { value: 'subtotal', label: '小计行', hint: '对上方数据行聚合' },
  { value: 'total', label: '合计行', hint: '对整表聚合' },
]

const COL_AGG_OPTIONS: Array<{ value: ColumnAgg | null; label: string }> = [
  { value: null, label: '无聚合' },
  { value: 'sum', label: '求和 (Σ)' },
  { value: 'avg', label: '平均 (Avg)' },
  { value: 'count', label: '计数 (Count)' },
  { value: 'min', label: '最小 (Min)' },
  { value: 'max', label: '最大 (Max)' },
]

const DATA_TYPE_OPTIONS: Array<{ value: DataType; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
]

const DATA_FORMAT_OPTIONS: Array<{ value: DataFormat; label: string }> = [
  { value: 'plain', label: '普通' },
  { value: 'currency', label: '货币' },
  { value: 'percent', label: '百分比' },
]

function Toolbar({
  editor,
  isFullscreen,
  onToggleFullscreen,
  onOpenLink,
  onOpenTable,
}: {
  editor: ReturnType<typeof useEditor>
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenLink: () => void
  onOpenTable: () => void
}) {
  if (!editor) return null
  const btn = (active: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-md text-sm hover:bg-accent ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`

  const insideTable = editor.isActive('table')
  const currentRowKind = useMemo<RowKind>(() => {
    if (!editor.isActive('tableRow')) return 'data'
    const attrs = editor.getAttributes('tableRow')
    const kind = attrs.dataRowKind
    return kind === 'subtotal' || kind === 'total' ? kind : 'data'
  }, [editor])

  const currentColAgg = useMemo<ColumnAgg | null>(() => {
    if (!editor.isActive('tableHeader')) return null
    const attrs = editor.getAttributes('tableHeader')
    const agg = attrs.colAgg
    if (agg === 'sum' || agg === 'avg' || agg === 'count' || agg === 'min' || agg === 'max') {
      return agg
    }
    return null
  }, [editor])

  const currentCellType = useMemo<DataType>(() => {
    if (!editor.isActive('tableCell')) return 'text'
    const attrs = editor.getAttributes('tableCell')
    return attrs.dataType === 'number' ? 'number' : 'text'
  }, [editor])

  const currentCellFormat = useMemo<DataFormat>(() => {
    if (!editor.isActive('tableCell')) return 'plain'
    const attrs = editor.getAttributes('tableCell')
    const fmt = attrs.dataFormat
    return fmt === 'currency' || fmt === 'percent' ? fmt : 'plain'
  }, [editor])

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
        <button
          type="button"
          title="插入表格"
          onClick={onOpenTable}
          className={btn(editor.isActive('table'))}
        >
          <TableIcon className="h-4 w-4" />
        </button>
        {insideTable && (
          <>
            <span className="mx-1 w-px self-stretch bg-border" />
            <SelectMenu
              label="行类型"
              value={currentRowKind}
              disabled={!editor.isActive('tableRow')}
              onChange={(next) => runAggregateCommand(editor, 'setRowKind', next)}
              options={ROW_KIND_OPTIONS}
            />
            <SelectMenu
              label="列聚合"
              value={currentColAgg ?? ''}
              disabled={!editor.isActive('tableHeader')}
              onChange={(next) =>
                runAggregateCommand(
                  editor,
                  'setColumnAgg',
                  next === '' ? null : (next as ColumnAgg),
                )
              }
              options={COL_AGG_OPTIONS.map((o) => ({ value: o.value ?? '', label: o.label }))}
            />
            <SelectMenu
              label="数据类型"
              value={currentCellType}
              disabled={!editor.isActive('tableCell')}
              onChange={(next) => runAggregateCommand(editor, 'setCellDataType', next)}
              options={DATA_TYPE_OPTIONS}
            />
            <SelectMenu
              label="数字格式"
              value={currentCellFormat}
              disabled={!editor.isActive('tableCell') || currentCellType !== 'number'}
              onChange={(next) => runAggregateCommand(editor, 'setCellFormat', next)}
              options={DATA_FORMAT_OPTIONS}
            />
          </>
        )}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            title={isFullscreen ? '退出全屏' : '全屏'}
            onClick={onToggleFullscreen}
            className={btn(false)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ChainCommands doesn't surface our custom aggregate commands in its
// typed shape, so we expose a single helper that does the untyped cast in
// one place. Keeps the call sites lint-clean and easy to audit.
function runAggregateCommand<K extends string>(
  editor: ReturnType<typeof useEditor>,
  command: K,
  value: unknown,
) {
  if (!editor) return
  // biome-ignore lint/suspicious/noExplicitAny: TipTap's ChainedCommands type doesn't include custom commands
  const chain = editor.chain().focus() as any
  chain[command](value).run()
}

type SelectMenuOption = { value: string; label: string; hint?: string }

function SelectMenu({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: ReadonlyArray<SelectMenuOption>
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const active = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? label
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs',
          disabled
            ? 'cursor-not-allowed text-muted-foreground/50'
            : open
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        title={label}
      >
        <span className="text-muted-foreground/70">{label}:</span>
        <span className="font-medium">{active}</span>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-md border border-border bg-surface py-1 text-sm shadow-md">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-accent',
                option.value === value && 'bg-accent/60',
              )}
            >
              <span className="font-medium text-foreground">{option.label}</span>
              {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
