import { describe, expect, it } from 'vitest'
import {
  createDocumentSchema,
  importMarkdownSchema,
  searchDocumentsSchema,
  updateDocumentSchema,
} from '~/shared/validation/document'

const doc = { type: 'doc' as const, content: [{ type: 'paragraph' }] }
const uuid = '00000000-0000-4000-8000-000000000001'

describe('document validation', () => {
  it('accepts a valid document payload', () => {
    const result = createDocumentSchema.safeParse({
      title: '团队文档规范',
      contentJson: doc,
      tags: ['Product', 'product'],
      status: 'published',
      spaceId: uuid,
      categoryId: null,
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.tags).toEqual(['product'])
  })

  it('requires a space when creating documents', () => {
    const result = createDocumentSchema.safeParse({
      title: '团队文档规范',
      contentJson: doc,
      tags: [],
      status: 'draft',
    })

    expect(result.success).toBe(false)
  })

  it('requires at least one field for updates', () => {
    const result = updateDocumentSchema.safeParse({ id: uuid })
    expect(result.success).toBe(false)
  })

  it('preserves status filters when searching documents', () => {
    const result = searchDocumentsSchema.parse({ status: 'draft', page: 1, pageSize: 5 })
    expect(result.status).toBe('draft')
  })

  it('accepts a valid markdown import payload', () => {
    const result = importMarkdownSchema.safeParse({
      title: '从 Markdown 导入',
      markdown: '# 标题\n\n正文 **加粗** 内容。',
      spaceId: uuid,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('draft')
      expect(result.data.tags).toEqual([])
    }
  })

  it('rejects markdown import without a spaceId', () => {
    const result = importMarkdownSchema.safeParse({
      title: '孤立的导入',
      markdown: 'no space provided',
    })
    expect(result.success).toBe(false)
  })

  it('caps import titles at 200 characters', () => {
    const result = importMarkdownSchema.safeParse({
      title: 'a'.repeat(201),
      markdown: '# t',
      spaceId: uuid,
    })
    expect(result.success).toBe(false)
  })

  it('requires non-empty markdown for import', () => {
    const result = importMarkdownSchema.safeParse({
      title: '空文档',
      markdown: '',
      spaceId: uuid,
    })
    expect(result.success).toBe(false)
  })
})
