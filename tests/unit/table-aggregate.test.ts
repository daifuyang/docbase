import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { __testing, freezeAggregates, parseCellNumber } from '~/lib/table-aggregate'

const { numberFormatter } = __testing

type JSONNode = JSONContent

function text(value: string): JSONNode {
  return { type: 'text', text: value }
}

function paragraph(value: string): JSONNode {
  return { type: 'paragraph', content: [text(value)] }
}

function headerCell(label: string, colAgg: string | null = null): JSONNode {
  const attrs: Record<string, unknown> = {}
  if (colAgg) attrs.colAgg = colAgg
  return {
    type: 'tableHeader',
    attrs,
    content: [paragraph(label)],
  }
}

function dataCell(value: string, dataType: 'text' | 'number' = 'text'): JSONNode {
  return {
    type: 'tableCell',
    attrs: { dataType },
    content: [paragraph(value)],
  }
}

function row(cells: JSONNode[], kind: 'data' | 'subtotal' | 'total' = 'data'): JSONNode {
  return {
    type: 'tableRow',
    attrs: { dataRowKind: kind },
    content: cells,
  }
}

function tableOf(rows: JSONNode[]): JSONNode {
  return { type: 'table', content: rows }
}

function doc(children: JSONNode[]): JSONContent {
  return { type: 'doc', content: children }
}

describe('parseCellNumber', () => {
  it.each([
    ['123', 123],
    ['123.45', 123.45],
    ['1,234.5', 1234.5],
    ['￥1000', 1000],
    ['50%', 50],
    ['  -42 ', -42],
    ['', null],
    ['abc', null],
    ['.', null],
    ['-', null],
  ])('parses %s', (input, expected) => {
    expect(parseCellNumber(input)).toBe(expected)
  })
})

describe('numberFormatter', () => {
  it('sums values', () => {
    expect(numberFormatter.sum([1, 2, 3])).toBe('6')
    expect(numberFormatter.sum([1.5, 2.5])).toBe('4')
  })

  it('averages values to 2dp', () => {
    expect(numberFormatter.avg([1, 2, 3])).toBe('2.00')
    expect(numberFormatter.avg([2])).toBe('2.00')
    expect(numberFormatter.avg([])).toBe('0')
  })

  it('counts non-empty values', () => {
    expect(numberFormatter.count([10, 20, 30])).toBe('3')
  })

  it('returns 0 for empty buckets on min/max', () => {
    expect(numberFormatter.min([])).toBe('0')
    expect(numberFormatter.max([])).toBe('0')
  })
})

describe('freezeAggregates', () => {
  it('fills subtotal rows with the sum of preceding data rows', () => {
    const input = doc([
      tableOf([
        row([headerCell('部门'), headerCell('金额', 'sum')]),
        row([dataCell('A', 'text'), dataCell('10', 'number')]),
        row([dataCell('B', 'text'), dataCell('20', 'number')]),
        row([dataCell('小计', 'text'), dataCell('', 'number')], 'subtotal'),
      ]),
    ])
    const result = freezeAggregates(input)
    const table = result.content?.[0]
    // header + 2 data rows + subtotal => subtotal is index 3
    const lastRow = table?.content?.[3]
    const lastCell = lastRow?.content?.[1] as JSONNode
    expect(lastCell.content?.[0]).toMatchObject({ type: 'paragraph' })
    const inner = (lastCell.content?.[0] as JSONNode).content?.[0] as JSONNode
    expect(inner.text).toBe('30')
    expect(lastCell.attrs?.dataComputed).toBe('30')
  })

  it('fills the total row with the sum of all data rows', () => {
    const input = doc([
      tableOf([
        row([headerCell('部门'), headerCell('金额', 'sum')]),
        row([dataCell('A', 'text'), dataCell('100', 'number')]),
        row([dataCell('B', 'text'), dataCell('250', 'number')]),
        row([dataCell('合计', 'text'), dataCell('', 'number')], 'total'),
      ]),
    ])
    const result = freezeAggregates(input)
    // header + 2 data rows + total => total is index 3
    const totalRow = result.content?.[0]?.content?.[3]
    const totalCell = totalRow?.content?.[1] as JSONNode
    expect(totalCell.content?.[0]?.content?.[0]?.text).toBe('350')
  })

  it('respects subtotal grouping when followed by another subtotal', () => {
    const input = doc([
      tableOf([
        row([headerCell('部门'), headerCell('金额', 'sum')]),
        row([dataCell('A1', 'text'), dataCell('1', 'number')]),
        row([dataCell('A2', 'text'), dataCell('2', 'number')]),
        row([dataCell('A 小计', 'text'), dataCell('', 'number')], 'subtotal'),
        row([dataCell('B1', 'text'), dataCell('10', 'number')]),
        row([dataCell('B 小计', 'text'), dataCell('', 'number')], 'subtotal'),
      ]),
    ])
    const result = freezeAggregates(input)
    const table = result.content?.[0]
    // rows: 0=header 1=A1 2=A2 3=A小计 4=B1 5=B小计
    const aSubtotal = (table?.content?.[3]?.content?.[1] as JSONNode).content?.[0]?.content?.[0]
      ?.text
    const bSubtotal = (table?.content?.[5]?.content?.[1] as JSONNode).content?.[0]?.content?.[0]
      ?.text
    expect(aSubtotal).toBe('3')
    expect(bSubtotal).toBe('10')
  })

  it('skips cells whose dataType is text', () => {
    const input = doc([
      tableOf([
        row([headerCell('count', 'sum')]),
        row([dataCell('not-a-number', 'text')]),
        row([dataCell('', 'number')], 'subtotal'),
      ]),
    ])
    const result = freezeAggregates(input)
    // rows: 0=header 1=data 2=subtotal
    const subtotalRow = result.content?.[0]?.content?.[2]
    const cell = subtotalRow?.content?.[0] as JSONNode
    expect(cell.content?.[0]?.content?.[0]?.text ?? '0').toBe('0')
  })

  it('handles average and count', () => {
    const input = doc([
      tableOf([
        row([headerCell('v', 'avg'), headerCell('c', 'count')]),
        row([dataCell('10', 'number'), dataCell('', 'number')]),
        row([dataCell('20', 'number'), dataCell('', 'number')]),
        row([dataCell('avg', 'text'), dataCell('cnt', 'text')], 'subtotal'),
      ]),
    ])
    const result = freezeAggregates(input)
    // rows: 0=header 1=data 2=data 3=subtotal
    const lastRow = result.content?.[0]?.content?.[3]
    const avgCell = lastRow?.content?.[0] as JSONNode
    const countCell = lastRow?.content?.[1] as JSONNode
    expect(avgCell.content?.[0]?.content?.[0]?.text).toBe('15.00')
    expect(countCell.content?.[0]?.content?.[0]?.text).toBe('2')
  })

  it('leaves text-only tables untouched', () => {
    const input = doc([tableOf([row([headerCell('name')]), row([dataCell('alice', 'text')])])])
    const result = freezeAggregates(input)
    expect(result).toEqual(input)
  })

  it('ignores docs without tables', () => {
    const input = doc([paragraph('hello world')])
    const result = freezeAggregates(input)
    expect(result).toEqual(input)
  })

  it('does not mutate the input document', () => {
    const input = doc([
      tableOf([
        row([headerCell('v', 'sum')]),
        row([dataCell('5', 'number')]),
        row([dataCell('', 'number')], 'subtotal'),
      ]),
    ])
    const snapshot = JSON.parse(JSON.stringify(input))
    freezeAggregates(input)
    expect(input).toEqual(snapshot)
  })
})
