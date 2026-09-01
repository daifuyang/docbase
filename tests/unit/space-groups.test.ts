import { describe, expect, it } from 'vitest'
import { SPACE_GROUPS, UNGROUPED_KEY, UNGROUPED_NAME, groupSpaces } from '~/lib/space-groups'
import type { SpaceTreeItem } from '~/shared/types'

/**
 * 构造一个最简 SpaceTreeItem——只填 groupSpaces 用得到的字段。
 * categories / documents 留空数组即可，逻辑不依赖它们的内容。
 */
function makeSpace(id: string, name: string): SpaceTreeItem {
  return {
    id,
    name,
    slug: id,
    description: null,
    categories: [],
    documents: [],
  }
}

describe('groupSpaces', () => {
  it('returns an empty array when there are no spaces', () => {
    expect(groupSpaces([])).toEqual([])
  })

  it('groups all known spaces into the right buckets', () => {
    const spaces: SpaceTreeItem[] = [
      makeSpace('s1', '公司治理与制度'),
      makeSpace('s2', '战略与经营'),
      makeSpace('s3', '财务法务'),
      makeSpace('s4', '安全与权限'),
      makeSpace('s5', '技术研发'),
      makeSpace('s6', 'OPC 超级个体'),
    ]

    const grouped = groupSpaces(spaces)

    expect(grouped).toHaveLength(3)
    expect(grouped[0]?.group.name).toBe('企业治理')
    expect(grouped[0]?.spaces.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4'])
    expect(grouped[1]?.group.name).toBe('研发')
    expect(grouped[1]?.spaces.map((s) => s.id)).toEqual(['s5'])
    expect(grouped[2]?.group.name).toBe('业务与项目')
    expect(grouped[2]?.spaces.map((s) => s.id)).toEqual(['s6'])
  })

  it('preserves the original space order within a group', () => {
    // provide spaces interleaved from two groups, in non-canonical input order
    const spaces: SpaceTreeItem[] = [
      makeSpace('a', '技术研发'),
      makeSpace('b', '公司治理与制度'),
      makeSpace('c', 'OPC 超级个体'),
      makeSpace('d', '战略与经营'),
    ]

    const grouped = groupSpaces(spaces)
    const governance = grouped.find((g) => g.group.name === '企业治理')
    expect(governance?.spaces.map((s) => s.id)).toEqual(['b', 'd'])
    const business = grouped.find((g) => g.group.name === '业务与项目')
    expect(business?.spaces.map((s) => s.id)).toEqual(['c'])
  })

  it('sends unknown spaces to the ungrouped bucket', () => {
    const spaces: SpaceTreeItem[] = [
      makeSpace('s1', '技术研发'),
      makeSpace('s2', '未知的 Space'),
      makeSpace('s3', '另一个未知 Space'),
    ]

    const grouped = groupSpaces(spaces)

    expect(grouped).toHaveLength(2)
    const unknown = grouped.find((g) => g.group.key === UNGROUPED_KEY)
    expect(unknown).toBeDefined()
    expect(unknown?.group.name).toBe(UNGROUPED_NAME)
    expect(unknown?.spaces.map((s) => s.id)).toEqual(['s2', 's3'])
  })

  it('omits empty groups (no header rendered when a group has zero matches)', () => {
    // Only supply spaces for "研发"; "企业治理" and "业务与项目" stay empty.
    const spaces: SpaceTreeItem[] = [makeSpace('s1', '技术研发')]

    const grouped = groupSpaces(spaces)

    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.group.name).toBe('研发')
    // And no ungrouped bucket either, since there are no unknowns.
    expect(grouped.some((g) => g.group.key === UNGROUPED_KEY)).toBe(false)
  })

  it('follows SPACE_GROUPS order for known groups, and pushes ungrouped to the end', () => {
    // intentionally scramble input order: feed business first, then engineering,
    // then governance, then an unknown.
    const spaces: SpaceTreeItem[] = [
      makeSpace('b1', 'OPC 超级个体'),
      makeSpace('e1', '技术研发'),
      makeSpace('g1', '公司治理与制度'),
      makeSpace('?', '未知 X'),
    ]

    const grouped = groupSpaces(spaces)

    expect(grouped.map((g) => g.group.key)).toEqual([
      'governance',
      'engineering',
      'business',
      UNGROUPED_KEY,
    ])
    // sanity: ordering matches SPACE_GROUPS index
    expect(grouped[0]?.group.key).toBe(SPACE_GROUPS[0]?.key)
    expect(grouped[1]?.group.key).toBe(SPACE_GROUPS[1]?.key)
    expect(grouped[2]?.group.key).toBe(SPACE_GROUPS[2]?.key)
  })

  it('drops the ungrouped bucket entirely when every space matches a known group', () => {
    const spaces: SpaceTreeItem[] = [makeSpace('s1', '公司治理与制度'), makeSpace('s2', '技术研发')]

    const grouped = groupSpaces(spaces)

    expect(grouped.some((g) => g.group.key === UNGROUPED_KEY)).toBe(false)
  })

  it('returns only the ungrouped bucket when no space matches any group', () => {
    const spaces: SpaceTreeItem[] = [makeSpace('a', '未知道路一'), makeSpace('b', '未知道路二')]

    const grouped = groupSpaces(spaces)

    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.group.key).toBe(UNGROUPED_KEY)
    expect(grouped[0]?.group.name).toBe(UNGROUPED_NAME)
    expect(grouped[0]?.spaces).toHaveLength(2)
  })
})
