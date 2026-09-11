'use client'

import { FilePlus2, FolderPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import type { KnowledgeCreateAction } from '~/components/knowledge/types'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

type Props = {
  /** Emitted when an item is picked. Wired to real behaviour in a later stage. */
  onAction: (action: KnowledgeCreateAction) => void
  /** Accessible label for the trigger; also used as the tooltip. */
  label?: string
  /** Render the trigger as a compact icon button (used by the section header). */
  className?: string
}

/**
 * Anchored create menu for the knowledge-space section header.
 *
 * Deliberately a Popover rather than a Dialog: creation is a lightweight
 * branching choice, and a modal would interrupt the tree the user is looking
 * at. Panel width and row height match the product spec (180px / 36px).
 */
export function CreateMenu({ onAction, label = '新建', className }: Props) {
  const [open, setOpen] = useState(false)

  const select = (action: KnowledgeCreateAction) => {
    // Close first: the inline folder row mounts in the tree behind this panel,
    // and leaving the menu open would cover it.
    setOpen(false)
    onAction(action)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          className,
        )}
        title={label}
        aria-label={label}
      >
        <Plus className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-1" align="end">
        <CreateMenuItem
          icon={<FilePlus2 className="h-4 w-4" />}
          onSelect={() => select('new-document')}
        >
          新建文档
        </CreateMenuItem>
        <CreateMenuItem
          icon={<FolderPlus className="h-4 w-4" />}
          onSelect={() => select('new-folder')}
        >
          新建文件夹
        </CreateMenuItem>
      </PopoverContent>
    </Popover>
  )
}

function CreateMenuItem({
  icon,
  onSelect,
  children,
}: {
  icon: React.ReactNode
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-sm text-foreground/85 outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </button>
  )
}
