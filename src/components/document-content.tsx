'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnAgg } from '~/lib/table-aggregate'

type Props = {
  html: string
}

// Aggregate kinds mirror what `freezeAggregates` writes into the cell
// `data-computed` attribute; we keep them in sync with
// `src/lib/table-aggregate.ts`.
const ALLOWED_AGGS: ReadonlyArray<ColumnAgg> = ['sum', 'avg', 'count', 'min', 'max']

type SelectionSummary = {
  count: number
  sum: number
  avg: number
  min: number
  max: number
}

const EMPTY_SUMMARY: SelectionSummary = { count: 0, sum: 0, avg: 0, min: 0, max: 0 }

function parseCellNumber(input: string): number | null {
  if (!input) return null
  const trimmed = input.trim()
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

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

function formatAgg(kind: ColumnAgg, values: number[]): string {
  if (values.length === 0) return '0'
  if (kind === 'sum') return formatNumber(values.reduce((a, b) => a + b, 0))
  if (kind === 'avg') return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
  if (kind === 'count') return values.length.toString()
  if (kind === 'min') return formatNumber(Math.min(...values))
  return formatNumber(Math.max(...values))
}

function recomputeTable(table: HTMLTableElement) {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return

  // Find header row: prefer the row inside <thead>; otherwise the first row
  // that contains any <th>. Header columns carry the `data-col-agg` semantic
  // that defines what each column aggregates.
  const headerRow =
    table.querySelector('thead tr') ??
    (rows.find((row) => row.querySelector('th')) as HTMLTableRowElement | undefined)
  if (!headerRow) return

  const columnAgg: Array<ColumnAgg | null> = []
  const headerCells = Array.from(headerRow.children) as HTMLElement[]
  for (const cell of headerCells) {
    if (cell.tagName !== 'TH') {
      columnAgg.push(null)
      continue
    }
    const raw = cell.getAttribute('data-col-agg')
    if (raw && (ALLOWED_AGGS as ReadonlyArray<string>).includes(raw)) {
      columnAgg.push(raw as ColumnAgg)
    } else {
      columnAgg.push(null)
    }
  }

  // Walk the rows in document order, bucketising numeric cells. Buckets
  // close whenever a subtotal/total row appears, mirroring the JS-side
  // `freezeAggregates` logic so SSR and CSR agree.
  type Bucket = { values: number[] }
  let active: Bucket = { values: [] }
  const buckets: Bucket[] = [active]
  const rowPlan: Array<{ row: HTMLTableRowElement; kind: string; bucketIndex: number }> = []

  for (const row of rows) {
    if (row === headerRow) {
      rowPlan.push({ row, kind: 'header', bucketIndex: -1 })
      continue
    }
    const kind = row.getAttribute('data-row-kind') ?? 'data'
    if (kind === 'data') {
      const cells = Array.from(row.children) as HTMLElement[]
      for (const cell of cells) {
        if (cell.tagName !== 'TD') continue
        if ((cell.getAttribute('data-type') ?? 'text') !== 'number') continue
        const value = parseCellNumber(cell.textContent ?? '')
        if (value !== null) active.values.push(value)
      }
      rowPlan.push({ row, kind, bucketIndex: buckets.indexOf(active) })
      continue
    }
    if (kind === 'subtotal') {
      rowPlan.push({ row, kind, bucketIndex: buckets.indexOf(active) })
      active = { values: [] }
      buckets.push(active)
      continue
    }
    if (kind === 'total') {
      rowPlan.push({ row, kind, bucketIndex: buckets.length - 1 })
      active = { values: [] }
      buckets.push(active)
    }
  }

  // Total bucket mirrors the union of all data values up to the total row,
  // matching `freezeAggregates` exactly.
  const allData: number[] = []
  for (const entry of rowPlan) {
    if (entry.kind !== 'data') continue
    const cells = Array.from(entry.row.children) as HTMLElement[]
    for (const cell of cells) {
      if (cell.tagName !== 'TD') continue
      if ((cell.getAttribute('data-type') ?? 'text') !== 'number') continue
      const value = parseCellNumber(cell.textContent ?? '')
      if (value !== null) allData.push(value)
    }
  }
  buckets[buckets.length - 1] = { values: allData }

  // Write back into the DOM. We don't touch <th> cells (text headers like
  // "部门小计" stay textual) and we don't touch <td> cells that lack an
  // aggregate definition for their column.
  for (const entry of rowPlan) {
    if (entry.kind !== 'subtotal' && entry.kind !== 'total') continue
    const bucket = buckets[entry.bucketIndex]
    if (!bucket) continue
    const cells = Array.from(entry.row.children) as HTMLElement[]
    cells.forEach((cell, columnIndex) => {
      if (cell.tagName !== 'TD') return
      const agg = columnAgg[columnIndex]
      if (!agg) return
      const computed = formatAgg(agg, bucket.values)
      cell.setAttribute('data-computed', computed)
      cell.textContent = computed
    })
  }
}

function isSelectionInsideTable(selection: Selection | null, container: HTMLElement): boolean {
  if (!selection || selection.rangeCount === 0) return false
  const range = selection.getRangeAt(0)
  if (range.collapsed) return false
  const tables = container.querySelectorAll('table')
  for (const table of tables) {
    if (table.contains(range.startContainer) && table.contains(range.endContainer)) {
      return true
    }
  }
  return false
}

function collectNumericCells(table: HTMLTableElement): HTMLTableCellElement[] {
  const cells: HTMLTableCellElement[] = []
  for (const cell of Array.from(table.querySelectorAll('td'))) {
    if (cell.getAttribute('data-type') === 'number' || cell.hasAttribute('data-computed')) {
      cells.push(cell as HTMLTableCellElement)
    }
  }
  return cells
}

/**
 * DocumentContent renders a server-sanitised HTML article and, after
 * hydration, runs two passes:
 *   1. Recompute aggregate cells in-place so the live numbers stay in sync
 *      with whatever the author edited last (the SSR pass can be stale).
 *   2. Attach a sticky selection-summary bar to each <table> when the
 *      user highlights two or more numeric cells — YuQue-style.
 */
export function DocumentContent({ html }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [summaryByTable, setSummaryByTable] = useState<Map<HTMLTableElement, SelectionSummary>>(
    new Map(),
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: html drives the recompute; containerRef is stable.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const tables = Array.from(container.querySelectorAll('table'))
    for (const table of tables) {
      recomputeTable(table as HTMLTableElement)
    }
  }, [html])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const tables = Array.from(container.querySelectorAll('table'))

    const recompute = () => {
      const next = new Map<HTMLTableElement, SelectionSummary>()
      for (const table of tables) {
        const numeric = collectNumericCells(table as HTMLTableElement)
        const values: number[] = []
        for (const cell of numeric) {
          const value = parseCellNumber(cell.textContent ?? '')
          if (value !== null) values.push(value)
        }
        if (values.length >= 2) {
          next.set(table as HTMLTableElement, {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
          })
        }
      }
      setSummaryByTable(next)
    }

    const onSelection = () => {
      if (!isSelectionInsideTable(window.getSelection(), container)) {
        if (summaryByTable.size > 0) setSummaryByTable(new Map())
        return
      }
      recompute()
    }

    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [summaryByTable])

  const hasAnySummary = summaryByTable.size > 0

  return (
    <>
      <div
        ref={containerRef}
        className="prose-docbase mt-6"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: document content is sanitized server-side.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hasAnySummary && <SelectionSummaryBars summaries={summaryByTable} />}
    </>
  )
}

function SelectionSummaryBars({
  summaries,
}: {
  summaries: Map<HTMLTableElement, SelectionSummary>
}) {
  // Render one floating bar per active table so each summary sits under its
  // own table — simpler than coordinate-tracking when the table scrolls.
  const entries = useMemo(() => Array.from(summaries.entries()), [summaries])
  return (
    <>
      {entries.map(([table, summary]) => (
        <div
          key={tableUniqueKey(table)}
          className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-surface-muted/80 px-3 py-1.5 text-xs text-muted-foreground"
        >
          <span className="font-medium text-foreground">选区统计</span>
          <span>求和 {formatNumber(summary.sum)}</span>
          <span>平均 {summary.avg.toFixed(2)}</span>
          <span>计数 {summary.count}</span>
          <span>最小 {formatNumber(summary.min)}</span>
          <span>最大 {formatNumber(summary.max)}</span>
        </div>
      ))}
    </>
  )
}

// WeakMap-friendly identity helper: DOM elements don't have a stable key,
// but each <table> in this map stays referenced for the lifetime of the
// selection cycle so the table reference itself is a safe key.
let keyCounter = 0
const tableKeyCache = new WeakMap<HTMLTableElement, number>()
function tableUniqueKey(table: HTMLTableElement): number {
  const cached = tableKeyCache.get(table)
  if (typeof cached === 'number') return cached
  keyCounter += 1
  tableKeyCache.set(table, keyCounter)
  return keyCounter
}

const _EMPTY_SUMMARY = EMPTY_SUMMARY // re-export to silence unused warnings
void _EMPTY_SUMMARY
