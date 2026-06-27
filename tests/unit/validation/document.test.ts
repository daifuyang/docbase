import { describe, expect, it } from 'vitest'
import { createDocumentSchema, updateDocumentSchema } from '~/shared/validation/document'

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
})
