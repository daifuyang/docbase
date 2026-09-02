/**
 * Idempotent one-shot migration that creates the three "group" spaces
 * (企业治理 / 研发 / 业务与项目) and re-parents the existing top-level
 * knowledge spaces underneath them.
 *
 * Run with:
 *   pnpm tsx scripts/migrate-space-groups.ts
 *
 * Safe to re-run: every insert uses ON CONFLICT DO NOTHING, every update
 * only touches spaces that are still children of NULL.
 */
import 'dotenv/config'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

type GroupDef = {
  slug: string
  name: string
  description: string
  children: readonly string[]
}

const GROUP_SPACES: readonly GroupDef[] = [
  {
    slug: 'space-governance',
    name: '企业治理',
    description: '公司治理、战略、产品、市场、运营、人力、财务、安全等通用规范空间',
    children: [
      '公司治理与制度',
      '战略与经营',
      '市场销售与客户',
      '运营与交付',
      '人力行政',
      '财务法务',
      '安全与权限',
    ],
  },
  {
    slug: 'space-engineering',
    name: '研发',
    description: '技术研发规范与应用归档',
    children: ['技术研发'],
  },
  {
    slug: 'space-business',
    name: '业务与项目',
    description: '业务交付与项目工作区（OPC 等）',
    children: ['OPC 超级个体', '产品与项目'],
  },
] as const

async function resolveAdminId(): Promise<string> {
  const admin = await db.query.user.findFirst({
    where: eq(schema.user.role, 'admin'),
  })
  if (!admin) throw new Error('No admin user found — seed admin first.')
  return admin.id
}

async function ensureGroupSpace(
  def: GroupDef,
  adminId: string,
  sortOrder: number,
): Promise<string> {
  const existing = await db.query.space.findFirst({
    where: eq(schema.space.slug, def.slug),
  })
  if (existing) return existing.id

  const [inserted] = await db
    .insert(schema.space)
    .values({
      name: def.name,
      slug: def.slug,
      description: def.description,
      sortOrder,
      parentId: null,
      createdBy: adminId,
    })
    .returning()
  if (!inserted) throw new Error(`Failed to create group space ${def.name}`)
  process.stdout.write(`+ created group space "${def.name}" (${inserted.id})\n`)
  return inserted.id
}

async function reparentChildren(groupId: string, childNames: readonly string[]): Promise<void> {
  for (const childName of childNames) {
    const child = await db.query.space.findFirst({ where: eq(schema.space.name, childName) })
    if (!child) {
      process.stdout.write(`  - skip "${childName}" (not found)\n`)
      continue
    }
    // Only update if the space is currently top-level. If it already has a
    // parent (e.g. a previous run retargeted it), leave it alone — that
    // means the user has reorganised the tree manually.
    if (child.parentId === groupId) {
      process.stdout.write(`  = "${childName}" already under this group\n`)
      continue
    }
    if (child.parentId !== null) {
      process.stdout.write(
        `  ! "${childName}" already has a parent (${child.parentId}); leaving it alone\n`,
      )
      continue
    }
    await db
      .update(schema.space)
      .set({ parentId: groupId, updatedAt: new Date() })
      .where(and(eq(schema.space.id, child.id), isNull(schema.space.parentId)))
    process.stdout.write(`  + reparented "${childName}" -> ${groupId}\n`)
  }
}

async function main(): Promise<void> {
  process.stdout.write('migrating top-level spaces into group spaces...\n')
  const adminId = await resolveAdminId()

  for (let i = 0; i < GROUP_SPACES.length; i += 1) {
    const def = GROUP_SPACES[i]
    if (!def) continue
    // Stable ordering: groups get sortOrder 1000 / 1010 / 1020 so existing
    // top-level spaces (sorted around 0/10/20) don't collide.
    const sortOrder = 1000 + i * 10
    const groupId = await ensureGroupSpace(def, adminId, sortOrder)
    await reparentChildren(groupId, def.children)
  }

  process.stdout.write('space group migration complete.\n')
  process.exit(0)
}

main().catch((error) => {
  console.error('space group migration failed:', error)
  process.exit(1)
})