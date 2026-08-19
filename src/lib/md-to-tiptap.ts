/**
 * Markdown → TipTap JSON converter.
 *
 * The grammar intentionally mirrors the legacy `/home/ubuntu/workspace/opc/scripts/md2tiptap.py`
 * converter (proven against the live docbase.zerocmf.com corpus) so behaviour
 * stays consistent for the same kind of well-formed Markdown. Differences
 * versus the Python script are limited to TypeScript ergonomics and an extra
 * size guard around the input — see {@link MAX_MARKDOWN_BYTES}.
 *
 * Output node vocabulary is restricted to the subset that the editor's
 * `extensions` list (see `tiptap-extensions.ts`) understands, so the result
 * round-trips through `generateHTML(renderTiptapToHtml)` without surprises.
 */
import type { JSONContent } from '@tiptap/core'

import type { TipTapDoc } from '~/shared/types'

export const MAX_MARKDOWN_BYTES = 200_000

type TextMark =
  | { type: 'bold' }
  | { type: 'code' }
  | { type: 'italic' }
  | { type: 'link'; attrs: { href: string; target?: string; rel?: string } }

type TextNode = { type: 'text'; text: string; marks?: TextMark[] }

type Paragraph = { type: 'paragraph'; content?: TextNode[] }
type Heading = { type: 'heading'; attrs: { level: number }; content?: TextNode[] }
type CodeBlock = {
  type: 'codeBlock'
  attrs?: { language?: string | null }
  content?: TextNode[]
}
type ListItem = {
  type: 'listItem'
  content: Array<Paragraph | Heading | CodeBlock | { type: 'text'; text: string }>
}
type BulletList = { type: 'bulletList'; content: ListItem[] }
type OrderedList = { type: 'orderedList'; content: ListItem[] }
type HorizontalRule = { type: 'horizontalRule' }
type TableCell = {
  type: 'tableHeader' | 'tableCell'
  attrs?: { colspan?: number; rowspan?: number; colwidth?: number | null }
  content?: Paragraph[]
}
type TableRow = { type: 'tableRow'; content: TableCell[] }
type Table = { type: 'table'; content: TableRow[] }

type BlockNode =
  | Paragraph
  | Heading
  | CodeBlock
  | BulletList
  | OrderedList
  | HorizontalRule
  | Table
  | TextNode

// -----------------------------------------------------------------------------
// Inline grammar
// -----------------------------------------------------------------------------

// `***bold-italic***` first, then `**bold**`, then `*italic*` / `_italic_`,
// then `` `code` ``, then `[label](url)` — order matters because the regex
// alternation is left-to-right and TipTap would otherwise treat nested
// patterns as separate marks.
const INLINE_PATTERN =
  /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

function parseInline(text: string): TextNode[] {
  const nodes: TextNode[] = []
  let cursor = 0
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const token = match[0]
    const start = match.index ?? 0
    if (start > cursor) {
      nodes.push({ type: 'text', text: text.slice(cursor, start) })
    }
    const node = tokenToTextNode(token)
    if (node) nodes.push(node)
    cursor = start + token.length
  }
  if (cursor < text.length) {
    nodes.push({ type: 'text', text: text.slice(cursor) })
  }
  return nodes.length > 0 ? nodes : []
}

function tokenToTextNode(token: string): TextNode | null {
  if (token.startsWith('***') && token.endsWith('***')) {
    return {
      type: 'text',
      text: token.slice(3, -3),
      marks: [{ type: 'bold' }, { type: 'italic' }],
    }
  }
  if (token.startsWith('**') && token.endsWith('**')) {
    return { type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] }
  }
  if (
    (token.startsWith('*') && token.endsWith('*')) ||
    (token.startsWith('_') && token.endsWith('_'))
  ) {
    return { type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] }
  }
  if (token.startsWith('`') && token.endsWith('`')) {
    return { type: 'text', text: token.slice(1, -1), marks: [{ type: 'code' }] }
  }
  if (token.startsWith('[') && token.includes('](')) {
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
    if (linkMatch) {
      const label = linkMatch[1] ?? ''
      const href = linkMatch[2] ?? ''
      return {
        type: 'text',
        text: label,
        marks: [{ type: 'link', attrs: { href } }],
      }
    }
  }
  return null
}

function paragraphFromText(text: string): Paragraph {
  return { type: 'paragraph', content: parseInline(text) }
}

// -----------------------------------------------------------------------------
// Block grammar
// -----------------------------------------------------------------------------

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/
const HR_PATTERN = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const UL_ITEM_PATTERN = /^\s*[-*+]\s+(.*)$/
const OL_ITEM_PATTERN = /^\s*\d+[.)]\s+(.*)$/
const CHECKBOX_PATTERN = /^\[([ xX])\]\s+(.*)$/
const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/
const TABLE_SEPARATOR_CELL_PATTERN = /^:?-{3,}:?$/
const TABLE_SEPARATOR_ROW_PATTERN = /^\s*\|[\s:|-]+\|\s*$/
const BLOCKQUOTE_PATTERN = /^>\s?(.*)$/

export function markdownToTipTap(input: string): TipTapDoc {
  if (typeof input !== 'string') {
    throw new TypeError('markdown input must be a string')
  }
  if (input.length === 0) {
    return { type: 'doc', content: [] }
  }
  if (Buffer.byteLength(input, 'utf8') > MAX_MARKDOWN_BYTES) {
    throw new RangeError(`Markdown payload exceeds ${MAX_MARKDOWN_BYTES} bytes; import rejected`)
  }

  const lines = input.split(/\r?\n/)
  const blocks: BlockNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() === '') {
      i += 1
      continue
    }

    // Fenced code block — language is whatever follows the opening fence
    // (e.g. ```ts); we don't try to validate it.
    if (/^\s*```/.test(line)) {
      const languageMatch = /^\s*```([^\s`]*)/.exec(line)
      const language = languageMatch?.[1] ? languageMatch[1] : null
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i] ?? '')) {
        body.push(lines[i] ?? '')
        i += 1
      }
      // Skip the closing fence if present (no error if absent — best effort).
      if (i < lines.length) i += 1
      const codeBlock: CodeBlock = {
        type: 'codeBlock',
        attrs: { language },
        content: body.length > 0 ? [{ type: 'text', text: body.join('\n') }] : [],
      }
      blocks.push(codeBlock)
      continue
    }

    // ATX heading: `# … ######`
    const headingMatch = HEADING_PATTERN.exec(line)
    if (headingMatch) {
      const hashes = headingMatch[1] ?? ''
      const text = headingMatch[2] ?? ''
      const level = hashes.length
      blocks.push({
        type: 'heading',
        attrs: { level },
        content: parseInline(text),
      })
      i += 1
      continue
    }

    // Horizontal rule
    if (HR_PATTERN.test(line)) {
      blocks.push({ type: 'horizontalRule' })
      i += 1
      continue
    }

    // Table — requires both the header row and the separator row to be
    // present on the next two lines; the separator row is dropped, the
    // header becomes `tableHeader` (`<th>`) cells.
    if (
      TABLE_ROW_PATTERN.test(line) &&
      i + 1 < lines.length &&
      TABLE_SEPARATOR_ROW_PATTERN.test(lines[i + 1] ?? '')
    ) {
      const rawRows: string[][] = []
      while (i < lines.length && TABLE_ROW_PATTERN.test(lines[i] ?? '')) {
        rawRows.push(splitTableRow(lines[i] ?? ''))
        i += 1
      }
      // rawRows = [header, separator, data…] — at minimum 2 rows.
      const header = rawRows[0] ?? []
      const body = rawRows[1] && isSeparatorRow(rawRows[1]) ? rawRows.slice(2) : rawRows.slice(1)
      blocks.push(buildTable(header, body))
      continue
    }

    // Bullet list (supports `-`, `*`, `+` markers and `[ ]` / `[x]` checkboxes)
    if (UL_ITEM_PATTERN.test(line)) {
      const items: ListItem[] = []
      while (i < lines.length && UL_ITEM_PATTERN.test(lines[i] ?? '')) {
        const raw = (lines[i] ?? '').replace(UL_ITEM_PATTERN, '$1')
        const cbMatch = CHECKBOX_PATTERN.exec(raw)
        let paragraphText = raw
        if (cbMatch) {
          const marker = cbMatch[1]?.toLowerCase() === 'x' ? '✅ ' : '⬜ '
          paragraphText = `${marker}${cbMatch[2] ?? ''}`
        }
        items.push({
          type: 'listItem',
          content: [paragraphFromText(paragraphText)],
        })
        i += 1
      }
      blocks.push({ type: 'bulletList', content: items })
      continue
    }

    // Ordered list (`1. ` or `1) `)
    if (OL_ITEM_PATTERN.test(line)) {
      const items: ListItem[] = []
      while (i < lines.length && OL_ITEM_PATTERN.test(lines[i] ?? '')) {
        const raw = (lines[i] ?? '').replace(OL_ITEM_PATTERN, '$1')
        items.push({
          type: 'listItem',
          content: [paragraphFromText(raw)],
        })
        i += 1
      }
      blocks.push({ type: 'orderedList', content: items })
      continue
    }

    // Blockquote — collapsed into a single paragraph (matches the
    // historical Python converter); > >  lines are joined with spaces.
    if (BLOCKQUOTE_PATTERN.test(line)) {
      const buf: string[] = []
      while (i < lines.length && BLOCKQUOTE_PATTERN.test(lines[i] ?? '')) {
        buf.push((lines[i] ?? '').replace(BLOCKQUOTE_PATTERN, '$1'))
        i += 1
      }
      blocks.push(paragraphFromText(buf.join(' ')))
      continue
    }

    // Plain paragraph — accumulate until the next blank line or any
    // block-level token to keep things like multi-line paragraphs.
    const paragraphBuffer: string[] = [line]
    i += 1
    while (i < lines.length && (lines[i] ?? '').trim() !== '' && !isBlockStart(lines[i] ?? '')) {
      paragraphBuffer.push(lines[i] ?? '')
      i += 1
    }
    blocks.push(paragraphFromText(paragraphBuffer.join(' ')))
  }

  return {
    type: 'doc',
    content: blocks.filter(isTipTapCompatible).map(toJSONContent),
  }
}

// -----------------------------------------------------------------------------
// Table helpers
// -----------------------------------------------------------------------------

function splitTableRow(line: string): string[] {
  // Trim leading/trailing pipes, then split — note this collapses empty
  // leading/trailing cells, but the editor handles ragged rows gracefully
  // by padding the missing cells with empty paragraphs.
  const trimmed = line.trim()
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const stripped = inner.endsWith('|') ? inner.slice(0, -1) : inner
  return stripped.split('|').map((cell) => cell.trim())
}

function isSeparatorRow(row: string[]): boolean {
  if (row.length === 0) return false
  return row.every((cell) => TABLE_SEPARATOR_CELL_PATTERN.test(cell))
}

function buildTable(header: string[], body: string[][]): Table {
  const headerRow: TableRow = {
    type: 'tableRow',
    content: header.map((cell) => ({
      type: 'tableHeader',
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [paragraphFromText(cell)],
    })),
  }
  const bodyRows: TableRow[] = body.map((row) => ({
    type: 'tableRow',
    content: row.map((cell) => ({
      type: 'tableCell',
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [paragraphFromText(cell)],
    })),
  }))
  return {
    type: 'table',
    content: [headerRow, ...bodyRows],
  }
}

// -----------------------------------------------------------------------------
// Misc helpers
// -----------------------------------------------------------------------------

function isBlockStart(line: string): boolean {
  return (
    HEADING_PATTERN.test(line) ||
    HR_PATTERN.test(line) ||
    UL_ITEM_PATTERN.test(line) ||
    OL_ITEM_PATTERN.test(line) ||
    BLOCKQUOTE_PATTERN.test(line) ||
    /^\s*```/.test(line)
  )
}

function isTipTapCompatible(node: BlockNode): boolean {
  // We only emit nodes whose `type` is in the registered editor schema —
  // this is a defensive filter, not a parser, but it ensures any future
  // additions that slip past the block dispatcher don't crash the editor.
  return [
    'paragraph',
    'heading',
    'codeBlock',
    'bulletList',
    'orderedList',
    'horizontalRule',
    'table',
  ].includes(node.type)
}

function toJSONContent(node: BlockNode): JSONContent {
  return node as JSONContent
}
