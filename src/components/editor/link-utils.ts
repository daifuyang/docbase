/**
 * URL helpers for the rich-text link modal.
 *
 * `normalizeLinkUrl` is pure and unit-tested in link-utils.test.ts.
 * `getLinkMode` reads from a live TipTap editor instance — it is exercised
 * by the e2e / manual flow, not by unit tests.
 */
import { type Editor, getMarkRange } from '@tiptap/core'

// Schemes we keep verbatim. Anything else (e.g. "example.com") is treated as
// missing-scheme and gets `https://` prepended, matching Notion's behaviour.
const SCHEME_RE = /^(https?|mailto|tel):/i

export function normalizeLinkUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return v
  if (v.startsWith('/')) return v
  if (SCHEME_RE.test(v)) return v
  return `https://${v}`
}

export type LinkMode =
  | { kind: 'create'; selectedText: string }
  | { kind: 'edit'; href: string; text: string }

export function getLinkMode(editor: Editor): LinkMode {
  // If the cursor sits inside a link (selection may be collapsed), treat
  // the whole link as the edit target so the modal can update its full
  // text in one shot.
  if (editor.isActive('link')) {
    const linkType = editor.schema.marks.link
    if (!linkType) return { kind: 'create', selectedText: '' }
    const range = getMarkRange(editor.state.selection.$from, linkType)
    const text = range ? editor.state.doc.textBetween(range.from, range.to, ' ') : ''
    const href = editor.getAttributes('link').href ?? ''
    return { kind: 'edit', href, text }
  }
  const { from, to } = editor.state.selection
  if (from === to) return { kind: 'create', selectedText: '' }
  const selectedText = editor.state.doc.textBetween(from, to, ' ')
  return { kind: 'create', selectedText }
}

/**
 * Walk the document and collect every distinct link href currently in
 * use. Used to populate the "Link list" dropdown in the modal so users
 * can pick an existing URL instead of retyping it.
 */
export function getExistingLinks(editor: Editor): string[] {
  const links = new Set<string>()
  editor.state.doc.descendants((node) => {
    if (!node.isText) return
    const linkMark = node.marks.find((m) => m.type.name === 'link')
    const href = linkMark?.attrs.href
    if (typeof href === 'string' && href.length > 0) {
      links.add(href)
    }
  })
  return Array.from(links)
}
