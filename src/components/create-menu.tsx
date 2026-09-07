'use client'

import { Link } from '@tanstack/react-router'
import { FileText, Folder, FolderPlus, FolderTree, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { cn } from '~/lib/utils'
import { CreateCategoryDialog } from './create-category-dialog'
import { CreateSubspaceDialog } from './create-subspace-dialog'

type Context =
  | {
      kind: 'space'
      spaceId: string
      spaceName: string
    }
  | {
      kind: 'sidebar'
    }

type Props = {
  /** Where the trigger is mounted. Drives whether sub-space creation is offered. */
  context: Context
  /** Whether the current user can create categories / sub-spaces. */
  canManageStructure: boolean
  /** Visual size of the trigger button. */
  size?: 'icon' | 'sm'
  /**
   * Sidebar triggers use an icon-only button; space-page triggers sit in a
   * header and read better as a labelled button. Pick one. Defaults to icon.
   */
  variant?: 'icon' | 'labelled'
  className?: string
  /**
   * Optional override for the new-document link target. The sidebar passes
   * `null` so we skip the document item entirely (sidebar doesn't know which
   * space the user means). The space page passes a route target.
   */
  newDocumentTo?: string
  newDocumentSearch?: Record<string, string>
}

/**
 * Three-way "+" trigger used by the sidebar and the space page header.
 *
 *   文档  ─► /documents/new?...          (always available)
 *   文件夹 ─► CreateCategoryDialog       (admin only)
 *   子空间 ─► CreateSubspaceDialog       (admin only, space page only)
 *
 * The two dialogs are lazily mounted only after the user picks that option —
 * this keeps the sidebar light and avoids loading the dialog bundle until a
 * user actually wants it.
 */
export function CreateMenu({
  context,
  canManageStructure,
  size = 'icon',
  variant = 'icon',
  className,
  newDocumentTo,
  newDocumentSearch,
}: Props) {
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [subspaceOpen, setSubspaceOpen] = useState(false)

  const showSubspace = context.kind === 'space' && canManageStructure

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            variant === 'icon' && size === 'icon' && 'h-7 w-7',
            variant === 'icon' && size === 'sm' && 'h-6 w-6',
            variant === 'labelled' && 'h-8 px-2.5 text-sm',
            className,
          )}
          title="新建"
        >
          {variant === 'icon' ? (
            <Plus className="h-3.5 w-3.5" />
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              <span>新建</span>
            </>
          )}
          <span className="sr-only">新建</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {newDocumentTo && (
            <DropdownMenuItem asChild>
              <Link to={newDocumentTo} search={newDocumentSearch as never}>
                <MenuIcon icon={<FileText className="h-4 w-4" />} />
                <span>新建文档</span>
              </Link>
            </DropdownMenuItem>
          )}
          {canManageStructure && (
            <>
              {(newDocumentTo || showSubspace) && <DropdownMenuSeparator />}
              {context.kind === 'space' && (
                <>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setCategoryOpen(true)
                    }}
                  >
                    <MenuIcon icon={<Folder className="h-4 w-4" />} />
                    <span>新建文件夹</span>
                  </DropdownMenuItem>
                  {showSubspace && (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault()
                        setSubspaceOpen(true)
                      }}
                    >
                      <MenuIcon icon={<FolderTree className="h-4 w-4" />} />
                      <span>新建子空间</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {context.kind === 'sidebar' && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <MenuIcon icon={<FolderPlus className="h-4 w-4" />} />
                    <span>新建空间…</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </>
          )}
          {!canManageStructure && !newDocumentTo && (
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
              当前没有可创建的内容
            </DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {context.kind === 'space' && canManageStructure && (
        <>
          <CreateCategoryDialog
            open={categoryOpen}
            onOpenChange={setCategoryOpen}
            spaceId={context.spaceId}
            spaceName={context.spaceName}
          />
          {showSubspace && (
            <CreateSubspaceDialog
              open={subspaceOpen}
              onOpenChange={setSubspaceOpen}
              parentSpaceId={context.spaceId}
              parentSpaceName={context.spaceName}
            />
          )}
        </>
      )}
    </>
  )
}

function MenuIcon({ icon }: { icon: ReactNode }) {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
      {icon}
    </span>
  )
}
