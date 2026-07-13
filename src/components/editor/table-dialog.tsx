'use client'

import type { Editor } from '@tiptap/react'
import { Table as TableIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'

type TableDialogProps = {
  editor: Editor | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_ROWS = 3
const DEFAULT_COLS = 3
const MIN_DIM = 1
const MAX_DIM = 20

// Quick "insert a table" modal. TipTap's `insertTable` expects positive
// integers; we clamp here so users don't get stuck on `NaN` if they
// accidentally delete the value.
export function TableDialog({ editor, open, onOpenChange }: TableDialogProps) {
  const [rows, setRows] = useState(DEFAULT_ROWS)
  const [cols, setCols] = useState(DEFAULT_COLS)

  useEffect(() => {
    if (open) {
      setRows(DEFAULT_ROWS)
      setCols(DEFAULT_COLS)
    }
  }, [open])

  const insert = () => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            插入表格
          </DialogTitle>
          <DialogDescription>
            设定初始行列；插入后可继续在工具栏调整列聚合与行类型。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 pb-4 sm:grid-cols-2">
          <NumberField
            id="docbase-table-rows"
            label="行数"
            value={rows}
            onChange={setRows}
            min={MIN_DIM}
            max={MAX_DIM}
          />
          <NumberField
            id="docbase-table-cols"
            label="列数"
            value={cols}
            onChange={setCols}
            min={MIN_DIM}
            max={MAX_DIM}
          />
        </div>
        <DialogFooter className="border-t border-border bg-surface-muted/40 px-6 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" size="sm" onClick={insert} disabled={!editor}>
            插入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  id,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  id: string
}) {
  return (
    <div className="space-y-1.5 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (!Number.isFinite(parsed)) return
          onChange(Math.max(min, Math.min(max, Math.round(parsed))))
        }}
      />
    </div>
  )
}
