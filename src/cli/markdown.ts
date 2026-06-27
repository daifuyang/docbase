import { generateJSON } from '@tiptap/html'
/**
 * Markdown + YAML frontmatter -> TipTap JSON converter.
 *
 * Frontmatter parsing is delegated to gray-matter (YAML).
 * Body conversion: marked.parse(md) -> HTML, then @tiptap/html generateJSON
 * using the same extensions list the server's read-time renderer uses.
 */
import matter from 'gray-matter'
import { marked } from 'marked'
import { extensions } from '~/lib/tiptap-extensions'
import type { TipTapDoc } from '~/shared/types'
import type { Frontmatter } from './types'

export function parseFrontmatter(src: string): { data: Frontmatter; body: string } {
  const { data, content } = matter(src)
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('frontmatter must include a non-empty `title` field')
  }
  if (data.status !== undefined && data.status !== 'draft' && data.status !== 'published') {
    throw new Error("frontmatter `status` must be 'draft' or 'published'")
  }
  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    throw new Error('frontmatter `tags` must be an array of strings')
  }
  if (data.tags) {
    for (const t of data.tags) {
      if (typeof t !== 'string') throw new Error('frontmatter `tags` must contain only strings')
    }
  }
  return { data: data as Frontmatter, body: content }
}

export function markdownToTiptap(md: string): TipTapDoc {
  const html = marked.parse(md, { gfm: true, breaks: false, async: false }) as string
  return generateJSON(html, extensions) as TipTapDoc
}
