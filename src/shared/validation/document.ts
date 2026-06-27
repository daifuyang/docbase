import { z } from 'zod'

export const tiptapDocSchema = z
  .object({
    type: z.literal('doc'),
    content: z.array(z.any()).optional(),
  })
  .passthrough()
  .refine((v) => JSON.stringify(v).length <= 200_000, {
    message: '正文大小超过 200KB',
  })

export const titleSchema = z.string().min(1, '请输入标题').max(200, '标题最多 200 个字符')

export const tagNameSchema = z
  .string()
  .min(1)
  .max(30, '单个标签最多 30 个字符')
  .transform((s) => s.toLowerCase().trim())

export const tagsArraySchema = z
  .array(tagNameSchema)
  .max(10, '最多 10 个标签')
  .default([])
  .transform((arr) => Array.from(new Set(arr)))

export const documentStatusSchema = z.enum(['draft', 'published'])

export const createDocumentSchema = z.object({
  title: titleSchema,
  contentJson: tiptapDocSchema,
  tags: tagsArraySchema,
  status: documentStatusSchema,
  spaceId: z.string().uuid('请选择知识空间'),
  categoryId: z.string().uuid('请选择分类').nullable().optional(),
})

export const updateDocumentSchema = z
  .object({
    id: z.string().uuid(),
    title: titleSchema.optional(),
    contentJson: tiptapDocSchema.optional(),
    tags: tagsArraySchema.optional(),
    status: documentStatusSchema.optional(),
    spaceId: z.string().uuid('请选择知识空间').optional(),
    categoryId: z.string().uuid('请选择分类').nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.contentJson !== undefined ||
      value.tags !== undefined ||
      value.status !== undefined ||
      value.spaceId !== undefined ||
      value.categoryId !== undefined,
    { message: '至少提供一个要更新的字段' },
  )

export const searchDocumentsSchema = z.object({
  query: z.string().trim().max(100).default(''),
  spaceSlug: z.string().optional(),
  categorySlug: z.string().optional(),
  tagSlug: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
