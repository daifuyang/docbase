import { describe, expect, it } from 'vitest'
import { normalizeDocumentContent } from '~/server/services/documents'
import type { TipTapDoc } from '~/shared/types'

describe('document content normalization', () => {
  it('removes a leading H1 that duplicates the document title', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '数据库规范' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '正文' }] },
      ],
    }

    const normalized = normalizeDocumentContent('数据库规范', doc)

    expect(normalized.content?.[0]?.type).toBe('paragraph')
  })

  it('downgrades remaining H1 nodes to H2', () => {
    const doc: TipTapDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '背景' }] },
      ],
    }

    const normalized = normalizeDocumentContent('数据库规范', doc)

    expect(normalized.content?.[0]?.attrs?.level).toBe(2)
  })
})
