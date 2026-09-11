'use client'

import { Copy, FolderInput, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { KnowledgeNodeAction, KnowledgeNodeType } from '~/components/knowledge/types'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

type Props = {
  nodeType: KnowledgeNodeType
  onAction: (action: KnowledgeNodeAction) => void
  /** Row label, used only to build accessible button names. */
  nodeName: string
}

/**
 * Per-node "more" menu, revealed on row hover.
 *
 * Menus differ by node type: a space can be renamed and configured, a folder
 * can additionally be moved or removed. Documents are not managed from this
 * menu at this stage.
 *
 * The action handlers currently only report the chosen action — the callers
 * own what happens next.
 */
export function NodeActionMenu({ nodeType, onAction, nodeName }: Props) {
  const [open, setOpen] = useState(false)
  const items = menuItemsFor(nodeType)

  const select = (action: KnowledgeNodeAction) => {
    // Some actions (inline folder creation) mount UI behind this panel, so it
    // must get out of the way before the handler runs.
    setOpen(false)
    onAction(action)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'opacity-0 hover:bg-background hover:text-foreground',
          'group-hover/node:opacity-100 data-[state=open]:opacity-100',
        )}
        title={`${nodeName} 更多操作`}
        aria-label={`${nodeName} 更多操作`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-1" align="end">
        {items.map((item) => (
          <button
            key={item.action}
            type="button"
            onClick={() => select(item.action)}
            className={cn(
              'flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-sm outline-none transition-colors',
              item.destructive
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground/85 hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

type MenuItem = {
  action: KnowledgeNodeAction
  label: string
  icon: ReactNode
  destructive?: boolean
}

function menuItemsFor(_nodeType: KnowledgeNodeType): MenuItem[] {
  return [
    { action: 'rename', label: '重命名', icon: <Pencil className="h-3.5 w-3.5" /> },
    { action: 'move', label: '移动', icon: <FolderInput className="h-3.5 w-3.5" /> },
    { action: 'copy', label: '复制', icon: <Copy className="h-3.5 w-3.5" /> },
    {
      action: 'delete',
      label: '删除',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      destructive: true,
    },
  ]
}
