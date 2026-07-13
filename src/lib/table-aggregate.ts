import type { JSONContent } from '@tiptap/core'

export type RowKind = 'data' | 'subtotal' | 'total'
export type DataType = 'text' | 'number'
export type DataFormat = 'plain' | 'currency' | 'percent'
export type ColumnAgg = 'sum' | 'avg' | 'count' | 'min' | 'max'

export type TableCellAttrs = {
  colspan?: number
  rowspan?: number
  colwidth?: number[] | null
  dataType?: DataType
  dataFormat?: DataFormat
}

export type TableHeaderAttrs = {
  colspan?: number
  rowspan?: number
  colwidth?: number[] | null
  colAgg?: ColumnAgg | null
}

export type TableRowAttrs = {
  dataRowKind?: RowKind
}

const DEFAULT_NUMBER_FORMAT = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(2)

const numberFormatter: Record<ColumnAgg, (values: number[]) => string> = {
  sum: (values) => DEFAULT_NUMBER_FORMAT(sum(values)),
  avg: (values) => (values.length === 0 ? '0' : (sum(values) / values.length).toFixed(2)),
  count: (values) => values.length.toString(),
  min: (values) => (values.length === 0 ? '0' : DEFAULT_NUMBER_FORMAT(Math.min(...values))),
  max: (values) => (values.length === 0 ? '0' : DEFAULT_NUMBER_FORMAT(Math.max(...values))),
}

function sum(values: number[]) {
  let total = 0
  for (const v of values) total += v
  return total
}

// Parse a free-form cell string into a finite number, or null when the
// cell isn't numeric. Strips whitespace, thousands separators, currency
// glyphs and trailing/leading punctuation. Locale-independent on purpose:
// we don't want one author using `1,234.5` and another `1.234,5` to break
// the same table.
export function parseCellNumber(input: string): number | null {
  if (input == null) return null
  const trimmed = String(input).trim()
  if (trimmed === '') return null
  const cleaned = trimmed
    .replace(/[\s ]/g, '')
    .replace(/,/g, '')
    .replace(/[$¥€£￥]/g, '')
    .replace(/%$/, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function collectText(node: JSONContent | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (!node.content) return ''
  return node.content.map((child) => collectText(child)).join('')
}

function setCellText(cell: JSONContent, text: string): JSONContent {
  // Preserve marks already on existing text nodes when possible; for the
  // frozen aggregate we deliberately keep it plain so the column formatting
  // attribute alone carries the visual semantics.
  return {
    ...cell,
    content: [
      {
        type: 'paragraph',
        content: text === '' ? [] : [{ type: 'text', text }],
      },
    ],
  }
}

function isTableRow(node: JSONContent | undefined): node is JSONContent & { type: 'tableRow' } {
  return Boolean(node && node.type === 'tableRow')
}

function getRowKind(row: JSONContent): RowKind {
  const kind = (row.attrs as TableRowAttrs | undefined)?.dataRowKind
  return kind === 'subtotal' || kind === 'total' ? kind : 'data'
}

function getColumnAgg(headerCell: JSONContent): ColumnAgg | null {
  const agg = (headerCell.attrs as TableHeaderAttrs | undefined)?.colAgg
  if (!agg) return null
  return ['sum', 'avg', 'count', 'min', 'max'].includes(agg) ? agg : null
}

function freezeTable(table: JSONContent): JSONContent {
  const rows = table.content?.filter(isTableRow) ?? []
  if (rows.length === 0) return table

  // Determine aggregate definition per logical column. We use the first row
  // whose cells are tableHeader as the canonical header — colspan/rowspan
  // flattening is intentionally out of scope for MVP.
  const headerRow = rows.find((row) =>
    (row.content ?? []).some((cell) => cell.type === 'tableHeader'),
  )
  const columnAgg: Array<ColumnAgg | null> = []
  if (headerRow) {
    for (const cell of headerRow.content ?? []) {
      if (cell.type === 'tableHeader') columnAgg.push(getColumnAgg(cell))
    }
  }

  // Walk the rows in order and feed each numeric cell into the active
  // running aggregate buckets. We close a bucket whenever we hit another
  // subtotal/total row so subtotals respect grouping.
  type BucketState = { values: number[] }
  let activeBucket: BucketState = { values: [] }
  const buckets: BucketState[] = [activeBucket]
  const rowOutputs: Array<{
    row: JSONContent
    kind: RowKind
    nextBucket?: BucketState
  }> = []

  for (const row of rows) {
    const kind = getRowKind(row)
    if (kind === 'data') {
      for (const cell of row.content ?? []) {
        if (cell.type !== 'tableCell') continue
        const cellType = (cell.attrs as TableCellAttrs | undefined)?.dataType ?? 'text'
        if (cellType !== 'number') continue
        const text = collectText(cell)
        const value = parseCellNumber(text)
        if (value !== null) activeBucket.values.push(value)
      }
      rowOutputs.push({ row, kind })
      continue
    }
    if (kind === 'subtotal') {
      rowOutputs.push({ row, kind })
      // Close current bucket — the next subtotal/total will start fresh.
      activeBucket = { values: [] }
      buckets.push(activeBucket)
      continue
    }
    // kind === 'total': single trailing total uses the bucket of all data
    // rows up to this point. We close the running bucket so any later
    // content (rare but allowed) starts new.
    rowOutputs.push({ row, kind })
    activeBucket = { values: [] }
    buckets.push(activeBucket)
  }

  // Recompute the total bucket to span every data row across the whole
  // table — totals should always reflect the full table, not the trailing
  // window. We do this by overwriting the last total bucket's values with
  // the union of all data rows that precede it.
  const allDataValues: number[] = []
  for (let i = 0; i < rowOutputs.length; i++) {
    const entry = rowOutputs[i]
    if (!entry || entry.kind !== 'data') continue
    for (const cell of entry.row.content ?? []) {
      if (cell.type !== 'tableCell') continue
      const cellType = (cell.attrs as TableCellAttrs | undefined)?.dataType ?? 'text'
      if (cellType !== 'number') continue
      const text = collectText(cell)
      const value = parseCellNumber(text)
      if (value !== null) allDataValues.push(value)
    }
  }
  // Replace the last bucket (the post-total bucket) with one that mirrors
  // allDataValues — used by the total row only.
  buckets[buckets.length - 1] = { values: allDataValues }

  // Map row → bucket index in lockstep. Each data row owns the bucket it
  // contributed to; subtotal rows close the prior bucket; total rows read
  // the post-total bucket.
  const perRowBucketIndex: number[] = []
  let bucketIdx = 0
  for (const entry of rowOutputs) {
    if (entry.kind === 'data') {
      perRowBucketIndex.push(bucketIdx)
      continue
    }
    if (entry.kind === 'subtotal') {
      perRowBucketIndex.push(bucketIdx)
      bucketIdx++
      continue
    }
    // total: points at the last bucket which we just rebuilt above
    perRowBucketIndex.push(buckets.length - 1)
  }

  const updatedRows = rowOutputs.map(({ row, kind }, idx) => {
    if (kind === 'data') return row
    const bucketIndex = perRowBucketIndex[idx] ?? 0
    const bucket = buckets[bucketIndex]
    if (!bucket) return row
    const newCells = (row.content ?? []).map((cell) => {
      if (cell.type === 'tableHeader') {
        // Aggregate header cells stay textual (e.g. "部门小计") — never
        // overwritten with a number.
        return cell
      }
      if (cell.type !== 'tableCell') return cell
      const columnIndex = (row.content ?? []).indexOf(cell)
      const agg = columnAgg[columnIndex]
      if (!agg) return cell
      const computed = numberFormatter[agg](bucket.values)
      const frozen = setCellText(cell, computed)
      return {
        ...frozen,
        attrs: {
          ...(frozen.attrs ?? {}),
          dataType: 'number' as const,
          dataComputed: computed,
        },
      }
    })
    return { ...row, content: newCells }
  })

  return { ...table, content: updatedRows }
}

export function freezeAggregates(doc: JSONContent): JSONContent {
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return doc
  const visit = (node: JSONContent): JSONContent => {
    if (node.type === 'table') return freezeTable(node)
    if (!node.content || node.content.length === 0) return node
    return { ...node, content: node.content.map(visit) }
  }
  return { ...doc, content: doc.content.map(visit) }
}

// Re-export for unit tests that want to drive the formatter directly.
export const __testing = { numberFormatter, parseCellNumber }
