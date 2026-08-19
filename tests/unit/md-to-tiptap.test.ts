import { describe, expect, it } from 'vitest'
import { MAX_MARKDOWN_BYTES, markdownToTipTap } from '~/lib/md-to-tiptap'
import { renderTiptapToHtml } from '~/lib/tiptap.server'
import type { TipTapDoc } from '~/shared/types'

const SAMPLE_MARKDOWN = `# 数据库规范示例

> 本文档演示 Markdown 导入能力，含 **加粗**、\`行内代码\` 与 [链接](https://example.com)。

## 代码块

\`\`\`ts
const greet = (name: string) => \`hi \${name}\`
\`\`\`

## 表格

| 部门 | 金额 | 备注 |
|------|------|------|
| 研发 | 100 | Q1 |
| 市场 | 200 | Q1 |

## 列表

- [ ] 待办事项
- [x] 已完成事项
- 普通条目

1. 第一步
2. 第二步

---

> 引用段落。
`

function roundtrip(doc: TipTapDoc): string {
  return renderTiptapToHtml(doc)
}

describe('markdownToTipTap', () => {
  it('returns an empty doc for empty input', () => {
    const doc = markdownToTipTap('')
    expect(doc.type).toBe('doc')
    expect(doc.content ?? []).toHaveLength(0)
  })

  it('throws for non-string input', () => {
    expect(() => markdownToTipTap(undefined as unknown as string)).toThrow(TypeError)
  })

  it('rejects payloads larger than the size cap', () => {
    const tooLarge = 'x'.repeat(MAX_MARKDOWN_BYTES + 1)
    expect(() => markdownToTipTap(tooLarge)).toThrow(RangeError)
  })

  it('converts headings with inline marks', () => {
    const doc = markdownToTipTap('# Hello **world**')
    expect(doc.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
    })
    // The converter preserves the requested level; downstream document
    // normalisation in `services/documents.ts` downgrades a leading H1
    // to H2 — that lives outside the converter itself.
    expect(html(doc)).toContain('<h1')
    expect(html(doc)).toContain('<strong>world</strong>')
  })

  it('renders GFM tables with header cells as <th> and no separator row', () => {
    const doc = markdownToTipTap(SAMPLE_MARKDOWN)
    const table = doc.content?.find((node) => node?.type === 'table')
    expect(table).toBeDefined()
    const rows = table?.content ?? []
    expect(rows.length).toBeGreaterThanOrEqual(3)
    const headerRow = rows[0]
    expect(headerRow?.type).toBe('tableRow')
    const headerCells = headerRow?.content ?? []
    expect(headerCells.length).toBe(3)
    for (const cell of headerCells) {
      expect(cell.type).toBe('tableHeader')
    }
    for (const row of rows.slice(1)) {
      for (const cell of row.content ?? []) {
        expect(cell.type).toBe('tableCell')
      }
    }

    const rendered = html(doc)
    expect(rendered).toContain('<th')
    expect(rendered).toContain('部门')
    expect(rendered).toContain('研发')
    expect(rendered).toContain('100')
    // Make sure the separator line (`------`) was not promoted to a data row.
    expect(rendered).not.toMatch(/>-+</)
    expect(rendered).not.toContain('------')
  })

  it('supports links and inline code marks', () => {
    const doc = markdownToTipTap('see [docs](https://example.com) and `npm i`')
    expect(html(doc)).toContain('href="https://example.com"')
    expect(html(doc)).toContain('<code>npm i</code>')
  })

  it('renders bullet + ordered lists and a horizontal rule', () => {
    const md = `
- alpha
- beta

1. first
2. second

---
`
    const doc = markdownToTipTap(md)
    const types = (doc.content ?? []).map((n) => n?.type)
    expect(types).toContain('bulletList')
    expect(types).toContain('orderedList')
    expect(types).toContain('horizontalRule')
    // generateHTML normalizes to `<hr />` (XHTML-style self-closing tag);
    // we don't care about the slash — only the tag's presence.
    expect(html(doc)).toMatch(/<hr\b[^>]*\/?>/)
  })

  it('preserves checkbox markers as prefixed emoji text', () => {
    const doc = markdownToTipTap('- [ ] todo\n- [x] done')
    const list = doc.content?.find((n) => n?.type === 'bulletList')
    expect(list).toBeDefined()
    const items = list?.content ?? []
    expect(items.length).toBe(2)
    const firstText = collectText(items[0])
    const secondText = collectText(items[1])
    expect(firstText).toContain('⬜')
    expect(secondText).toContain('✅')
  })

  it('handles a fenced code block with a language', () => {
    const doc = markdownToTipTap('```ts\nconst x = 1\n```')
    const code = doc.content?.find((n) => n?.type === 'codeBlock')
    expect(code?.attrs?.language).toBe('ts')
    const text = collectText(code)
    expect(text).toContain('const x = 1')
  })

  it('keeps multi-line paragraphs joined with a single space', () => {
    const doc = markdownToTipTap('line one\nline two\nline three')
    const para = doc.content?.find((n) => n?.type === 'paragraph')
    const text = collectText(para)
    expect(text).toBe('line one line two line three')
  })

  it('round-trips through generateHTML without throwing on the canonical sample', () => {
    const doc = markdownToTipTap(SAMPLE_MARKDOWN)
    // generateHTML must not raise; round-trip via the production extensions
    // list (same one the server uses for rendering).
    const output = roundtrip(doc)
    // The leading H1 is left as-is by the converter; later it gets
    // normalised to H2 by the document service. We only check that *some*
    // heading is rendered so the test is meaningful without coupling to
    // the downstream normalisation pass.
    expect(output).toMatch(/<h[1-6]\b/)
    expect(output).toContain('<table')
    expect(output).toContain('<th')
    expect(output).toContain('<strong>')
    expect(output).toContain('<code>')
    expect(output).toContain('href="https://example.com"')
  })
})

function html(doc: TipTapDoc): string {
  return renderTiptapToHtml(doc)
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  if (Array.isArray(value)) return value.map(collectText).join('')
  const node = value as { text?: unknown; content?: unknown }
  if (typeof node.text === 'string') return node.text
  return collectText(node.content)
}
