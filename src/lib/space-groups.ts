import { Briefcase, CircleDashed, Code2, Landmark, type LucideIcon } from 'lucide-react'
import type { SpaceTreeItem } from '~/shared/types'

/**
 * 虚拟分组定义——把顶级 space 按"职能大类"在 sidebar 里视觉分组。
 * 注意：组本身不存数据、不带路由 key，纯粹的客户端 UI 容器。
 */
export type SpaceGroup = {
  /** 路由/group key（内部使用） */
  key: string
  /** 显示名（简体中文） */
  name: string
  /** 该组下的 space 名称列表（用 space.name 匹配） */
  spaceNames: readonly string[]
  /** 组标题前置图标（lucide-react 组件，h-3 w-3 渲染） */
  icon: LucideIcon
}

export const SPACE_GROUPS: readonly SpaceGroup[] = [
  {
    key: 'governance',
    name: '企业治理',
    icon: Landmark,
    spaceNames: [
      '公司治理与制度',
      '战略与经营',
      '产品与项目',
      '市场销售与客户',
      '运营与交付',
      '人力行政',
      '财务法务',
      '安全与权限',
    ],
  },
  {
    key: 'engineering',
    name: '研发',
    icon: Code2,
    spaceNames: ['技术研发'],
  },
  {
    key: 'business',
    name: '业务与项目',
    icon: Briefcase,
    spaceNames: ['OPC 超级个体'],
  },
] as const

/** 兜底分组：未匹配到任何 SPACE_GROUPS 的 space 落在这里 */
export const UNGROUPED_KEY = 'ungrouped'
export const UNGROUPED_NAME = '其他'
export const UNGROUPED_ICON: LucideIcon = CircleDashed

/** 兜底分组的 group 字段类型（写死 key / name / icon，spaceNames 始终为空） */
export type UngroupedGroupMeta = {
  key: typeof UNGROUPED_KEY
  name: typeof UNGROUPED_NAME
  icon: LucideIcon
  spaceNames: readonly string[]
}

/** groupSpaces 返回的单个桶：已知组或未分组兜底组 */
export type GroupedSpaceBucket = {
  group: SpaceGroup | UngroupedGroupMeta
  spaces: SpaceTreeItem[]
}

/**
 * 把 space 列表按 SPACE_GROUPS 分组。
 * - 匹配到的 space 进对应组；
 * - 未匹配到的（未知 space）进 `ungrouped` 默认组，组名"其他"；
 * - SPACE_GROUPS 顺序即显示顺序；
 * - 每个分组内 space 保持原顺序；
 * - 空组（没有任何匹配的）不会出现在结果里。
 */
export function groupSpaces(spaces: SpaceTreeItem[]): GroupedSpaceBucket[] {
  // name -> group index lookup for O(1) match
  const nameToGroup = new Map<string, number>()
  SPACE_GROUPS.forEach((group, idx) => {
    for (const name of group.spaceNames) {
      nameToGroup.set(name, idx)
    }
  })

  // pre-create buckets in SPACE_GROUPS order
  const buckets: GroupedSpaceBucket[] = SPACE_GROUPS.map((group) => ({ group, spaces: [] }))
  const unmatched: SpaceTreeItem[] = []

  for (const space of spaces) {
    const idx = nameToGroup.get(space.name)
    if (idx === undefined) {
      unmatched.push(space)
    } else {
      const bucket = buckets[idx]
      if (bucket) bucket.spaces.push(space)
    }
  }

  const result: GroupedSpaceBucket[] = []
  for (const bucket of buckets) {
    if (bucket.spaces.length > 0) result.push(bucket)
  }
  if (unmatched.length > 0) {
    result.push({
      group: { key: UNGROUPED_KEY, name: UNGROUPED_NAME, icon: UNGROUPED_ICON, spaceNames: [] },
      spaces: unmatched,
    })
  }
  return result
}
