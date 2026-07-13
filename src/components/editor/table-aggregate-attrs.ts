import { mergeAttributes } from '@tiptap/core'
import type { TableCellOptions } from '@tiptap/extension-table-cell'
import TableCell from '@tiptap/extension-table-cell'
import type { TableHeaderOptions } from '@tiptap/extension-table-header'
import TableHeader from '@tiptap/extension-table-header'
import type { TableRowOptions } from '@tiptap/extension-table-row'
import TableRow from '@tiptap/extension-table-row'

import type { ColumnAgg, DataFormat, DataType, RowKind } from '~/lib/table-aggregate'

// Subtotal row kinds. We intentionally don't extend `data` so a fresh row
// from TipTap's default `insertTable` keeps its natural semantics.
const ROW_KIND_OPTIONS: ReadonlyArray<RowKind> = ['data', 'subtotal', 'total']
const DATA_TYPE_OPTIONS: ReadonlyArray<DataType> = ['text', 'number']
const DATA_FORMAT_OPTIONS: ReadonlyArray<DataFormat> = ['plain', 'currency', 'percent']
const COLUMN_AGG_OPTIONS: ReadonlyArray<ColumnAgg> = ['sum', 'avg', 'count', 'min', 'max']

function readAttr<T extends string>(
  element: HTMLElement,
  name: string,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  const raw = element.getAttribute(name)
  if (!raw) return fallback
  return (allowed as ReadonlyArray<string>).includes(raw) ? (raw as T) : fallback
}

function readAttrOrNull<T extends string>(
  element: HTMLElement,
  name: string,
  allowed: ReadonlyArray<T>,
): T | null {
  const raw = element.getAttribute(name)
  if (!raw) return null
  return (allowed as ReadonlyArray<string>).includes(raw) ? (raw as T) : null
}

export const TableRowAggregate = TableRow.extend<TableRowOptions>({
  addAttributes() {
    return {
      dataRowKind: {
        default: 'data',
        parseHTML: (element) =>
          readAttr<RowKind>(element as HTMLElement, 'data-row-kind', ROW_KIND_OPTIONS, 'data'),
        renderHTML: (attributes) =>
          attributes.dataRowKind && attributes.dataRowKind !== 'data'
            ? { 'data-row-kind': attributes.dataRowKind }
            : {},
      },
    }
  },
})

export const TableHeaderAggregate = TableHeader.extend<TableHeaderOptions>({
  addAttributes() {
    return {
      // We piggyback on TipTap's existing colspan/rowspan/colwidth
      // attributes by extending the same node — keeps parsing symmetric
      // with the original extension.
      colAgg: {
        default: null,
        parseHTML: (element) =>
          readAttrOrNull<ColumnAgg>(element as HTMLElement, 'data-col-agg', COLUMN_AGG_OPTIONS),
        renderHTML: (attributes) =>
          attributes.colAgg ? { 'data-col-agg': attributes.colAgg } : {},
      },
    }
  },
})

export const TableCellAggregate = TableCell.extend<TableCellOptions>({
  addAttributes() {
    return {
      dataType: {
        default: 'text',
        parseHTML: (element) =>
          readAttr<DataType>(element as HTMLElement, 'data-type', DATA_TYPE_OPTIONS, 'text'),
        renderHTML: (attributes) =>
          attributes.dataType && attributes.dataType !== 'text'
            ? { 'data-type': attributes.dataType }
            : {},
      },
      dataFormat: {
        default: 'plain',
        parseHTML: (element) =>
          readAttr<DataFormat>(element as HTMLElement, 'data-format', DATA_FORMAT_OPTIONS, 'plain'),
        renderHTML: (attributes) =>
          attributes.dataFormat && attributes.dataFormat !== 'plain'
            ? { 'data-format': attributes.dataFormat }
            : {},
      },
    }
  },
})

// Wrapper extension exposing the "set current row to subtotal" command so
// the toolbar can toggle without needing direct access to TipTap internals.
import { Extension } from '@tiptap/core'
import type { Command, CommandProps, RawCommands } from '@tiptap/core'

function findAncestorNode(
  state: CommandProps['state'],
  typeName: string,
): { node: ReturnType<(typeof state)['selection']['$from']['node']>; pos: number } | null {
  const { $from } = state.selection
  let depth = $from.depth
  while (depth > 0) {
    const node = $from.node(depth)
    if (node.type.name === typeName) {
      return { node, pos: $from.before(depth) }
    }
    depth -= 1
  }
  return null
}

export const TableAggregateCommands = Extension.create({
  name: 'tableAggregateCommands',
  addCommands() {
    return {
      setRowKind:
        (kind: RowKind): Command =>
        ({ tr, state, dispatch }: CommandProps) => {
          const found = findAncestorNode(state, 'tableRow')
          if (!found) return false
          if (!dispatch) return true
          tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            dataRowKind: kind,
          })
          return true
        },
      setColumnAgg:
        (agg: ColumnAgg | null): Command =>
        ({ tr, state, dispatch }: CommandProps) => {
          const found = findAncestorNode(state, 'tableHeader')
          if (!found) return false
          if (dispatch) {
            tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, colAgg: agg })
          }
          return true
        },
      setCellDataType:
        (dataType: DataType): Command =>
        ({ tr, state, dispatch }: CommandProps) => {
          const found = findAncestorNode(state, 'tableCell')
          if (!found) return false
          if (dispatch) {
            tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, dataType })
          }
          return true
        },
      setCellFormat:
        (format: DataFormat): Command =>
        ({ tr, state, dispatch }: CommandProps) => {
          const found = findAncestorNode(state, 'tableCell')
          if (!found) return false
          if (dispatch) {
            tr.setNodeMarkup(found.pos, undefined, {
              ...found.node.attrs,
              dataFormat: format,
            })
          }
          return true
        },
    } as Partial<RawCommands>
  },
})

// Re-export mergeAttributes so consumers composing additional HTML
// attributes can keep parity with how the underlying extensions merge.
export { mergeAttributes }
