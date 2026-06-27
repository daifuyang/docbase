/**
 * Seed script for the internal knowledge-base MVP.
 * Run with: pnpm db:seed
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { auth } from '../src/lib/auth.server'
import { slugify } from '../src/lib/slug.server'
import { db } from './index'
import * as schema from './schema'

type TipTapDoc = {
  type: 'doc'
  content?: Array<Record<string, unknown>>
}

const USERS = [
  {
    email: 'admin@example.com',
    username: 'admin',
    password: 'admin123',
    displayName: '管理员',
    bio: '知识库管理员',
    role: 'admin' as const,
  },
  {
    email: 'alice@example.com',
    username: 'alice',
    password: 'Password123!',
    displayName: 'Alice',
    bio: '产品与前端',
    role: 'member' as const,
  },
  {
    email: 'bob@example.com',
    username: 'bob',
    password: 'Password123!',
    displayName: 'Bob',
    bio: '后端与基础设施',
    role: 'member' as const,
  },
]

const SPACES = [
  {
    name: '产品知识库',
    description: '需求、规范、复盘与设计决策',
    categories: ['产品规范', '项目复盘'],
  },
  {
    name: '工程知识库',
    description: '研发流程、架构说明与故障手册',
    categories: ['研发规范', '运维手册'],
  },
]

const DOCUMENTS = [
  {
    author: 'admin',
    space: '产品知识库',
    category: '产品规范',
    title: 'DocBase 信息架构规范',
    tags: ['ia', 'product'],
  },
  {
    author: 'alice',
    space: '产品知识库',
    category: '项目复盘',
    title: '搜索体验迭代复盘',
    tags: ['search', 'review'],
  },
  {
    author: 'bob',
    space: '工程知识库',
    category: '研发规范',
    title: 'TanStack Start 服务端约定',
    tags: ['frontend', 'architecture'],
  },
  {
    author: 'bob',
    space: '工程知识库',
    category: '运维手册',
    title: 'PostgreSQL 备份与恢复流程',
    tags: ['database', 'ops'],
  },
]

function tiptapDoc(text: string): TipTapDoc {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

async function main() {
  process.stdout.write('seeding knowledge base...\n')

  const userIds = new Map<string, string>()
  for (const user of USERS) {
    let row = await db.query.user.findFirst({ where: eq(schema.user.email, user.email) })
    if (!row) {
      const result = await auth.api.signUpEmail({
        body: {
          email: user.email,
          password: user.password,
          name: user.displayName,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
        } as never,
      })
      row = await db.query.user.findFirst({
        where: eq(schema.user.id, (result as { user: { id: string } }).user.id),
      })
    }
    if (!row) throw new Error(`failed to create user ${user.username}`)
    await db.update(schema.user).set({ role: user.role }).where(eq(schema.user.id, row.id))
    userIds.set(user.username, row.id)
  }

  const spaceIds = new Map<string, string>()
  const categoryIds = new Map<string, string>()
  const adminId = userIds.get('admin')
  if (!adminId) throw new Error('admin user missing')

  for (const item of SPACES) {
    let space = await db.query.space.findFirst({ where: eq(schema.space.slug, slugify(item.name)) })
    if (!space) {
      const [created] = await db
        .insert(schema.space)
        .values({
          name: item.name,
          slug: slugify(item.name),
          description: item.description,
          createdBy: adminId,
        })
        .returning()
      if (!created) throw new Error(`failed to create space ${item.name}`)
      space = created
    }
    spaceIds.set(item.name, space.id)

    for (const categoryName of item.categories) {
      let category = await db.query.category.findFirst({
        where: eq(schema.category.slug, slugify(categoryName)),
      })
      if (!category) {
        const [created] = await db
          .insert(schema.category)
          .values({
            spaceId: space.id,
            name: categoryName,
            slug: slugify(categoryName),
          })
          .returning()
        if (!created) throw new Error(`failed to create category ${categoryName}`)
        category = created
      }
      categoryIds.set(`${item.name}/${categoryName}`, category.id)
    }
  }

  for (const item of DOCUMENTS) {
    const spaceId = spaceIds.get(item.space)
    const categoryId = categoryIds.get(`${item.space}/${item.category}`)
    const authorId = userIds.get(item.author)
    if (!spaceId || !authorId) continue

    const slug = slugify(item.title)
    const existing = await db.query.document.findFirst({ where: eq(schema.document.slug, slug) })
    if (existing) continue

    const [document] = await db
      .insert(schema.document)
      .values({
        authorId,
        lastEditorId: authorId,
        spaceId,
        categoryId,
        title: item.title,
        slug,
        contentJson: tiptapDoc(`这是《${item.title}》的示例内容，用于展示团队文档结构。`),
        excerpt: `这是《${item.title}》的示例内容，用于展示团队文档结构。`,
        status: 'published',
        publishedAt: new Date(),
      })
      .returning()
    if (!document) throw new Error(`failed to create document ${item.title}`)

    for (const tagName of item.tags) {
      let tag = await db.query.tag.findFirst({ where: eq(schema.tag.name, tagName) })
      if (!tag) {
        const [created] = await db
          .insert(schema.tag)
          .values({ name: tagName, slug: slugify(tagName) })
          .returning()
        if (!created) throw new Error(`failed to create tag ${tagName}`)
        tag = created
      }
      await db
        .insert(schema.documentTag)
        .values({ documentId: document.id, tagId: tag.id })
        .onConflictDoNothing()
    }
  }

  process.stdout.write('seed complete\n')
  process.exit(0)
}

main().catch((error) => {
  console.error('seed failed:', error)
  process.exit(1)
})
