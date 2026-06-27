import { generateHTML } from '@tiptap/html'
import type { TipTapDoc } from '~/shared/types'
import { sanitizeHtml } from './sanitize.server'
import { extensions } from './tiptap-extensions'

export function renderTiptapToHtml(doc: TipTapDoc): string {
  const raw = generateHTML(doc as Parameters<typeof generateHTML>[0], extensions)
  return sanitizeHtml(withHeadingIds(raw))
}

function withHeadingIds(html: string) {
  return html.replace(/<h([1-3])([^>]*)>(.*?)<\/h\1>/g, (match, level, attrs, content) => {
    if (String(attrs).includes(' id=')) return match
    const text = String(content)
      .replace(/<[^>]+>/g, '')
      .trim()
    if (!text) return match
    return `<h${level}${attrs} id="${encodeURIComponent(text.toLowerCase().replace(/\s+/g, '-'))}">${content}</h${level}>`
  })
}
