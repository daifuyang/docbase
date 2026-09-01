'use client'

import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Home,
  NotebookPen,
  Plus,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { cn } from '~/lib/utils'
import { updateNavigationTreeState } from '~/server/spaces'
import type { SpaceTreeItem } from '~/shared/types'

type Props = {
  popularTags?: Array<{ name: string; slug: string }>
  spaces?: SpaceTreeItem[]
  expandedKeys?: string[]
  className?: string
  contentClassName?: string
}

export function Sidebar({
  popularTags = [],
  spaces = [],
  expandedKeys = [],
  className,
  contentClassName,
}: Props) {
  return (
    <aside className={cn('w-64 shrink-0', className)}>
      <SidebarContent
        popularTags={popularTags}
        spaces={spaces}
        expandedKeys={expandedKeys}
        className={contentClassName}
      />
    </aside>
  )
}

export function SidebarContent({
  popularTags = [],
  spaces = [],
  expandedKeys = [],
  className,
}: Props) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [openKeys, setOpenKeys] = useState(() => new Set(expandedKeys))
  const [, startTransition] = useTransition()
  const activeKeys = useMemo(() => collectActiveTreeKeys(spaces, pathname), [spaces, pathname])

  useEffect(() => {
    // Route loaders can revalidate after following a space or document link.
    // Merge their persisted state instead of replacing local state, so a
    // navigation never collapses folders the user has already opened.
    setOpenKeys((current) => new Set([...current, ...expandedKeys, ...activeKeys]))
  }, [expandedKeys, activeKeys])

  const updateOpenKeys = (next: Set<string>) => {
    setOpenKeys(next)
    startTransition(async () => {
      await updateNavigationTreeState({ data: { expandedKeys: [...next] } }).catch(() => {})
    })
  }

  const toggle = (key: string) => {
    const next = new Set(openKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    updateOpenKeys(next)
  }

  return (
    <div className={cn('space-y-5', className)}>
      <nav className="space-y-1">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          工作区
        </div>
        <SidebarLink to="/" icon={<Home className="h-4 w-4" />}>
          知识首页
        </SidebarLink>
        <SidebarLink to="/notes" icon={<NotebookPen className="h-4 w-4" />}>
          我的小记
        </SidebarLink>
      </nav>

      {spaces.length > 0 && (
        <nav className="space-y-1">
          <div className="flex items-center justify-between px-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              知识空间
            </div>
            <Link
              to="/documents/new"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="新建文档"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only">新建文档</span>
            </Link>
          </div>
          {spaces.map((space) => (
            <TreeSpace
              key={space.id}
              space={space}
              depth={0}
              isOpen={openKeys.has(spaceKey(space.id))}
              openKeys={openKeys}
              onToggle={toggle}
            />
          ))}
        </nav>
      )}

      {popularTags.length > 0 && (
        <nav className="space-y-1 border-t border-border/70 pt-4">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            标签筛选
          </div>
          <div className="flex flex-wrap gap-1.5 px-2">
            {popularTags.slice(0, 10).map((t) => (
              <Link
                key={t.slug}
                to="/tags/$slug"
                params={{ slug: t.slug }}
                className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                #{t.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

type TreeSpaceProps = {
  space: SpaceTreeItem
  /**
   * Visual indentation level. Pass `0` for top-level spaces. The component
   * does **not** branch on this value — it only feeds the indent helper so
   * nested rows slide right. The rendering path is identical at every depth,
   * so any future `parent_id` chain renders automatically without code
   * changes.
   */
  depth: number
  isOpen: boolean
  openKeys: Set<string>
  onToggle: (key: string) => void
}

/**
 * Recursive space node — single rendering path for every depth.
 *
 *   <row> + <TreeNode(child) for each> + <categories + docs>
 *
 * There is intentionally no "top-level" vs "child" code branch: a top-level
 * space is just a `TreeSpace` whose `depth === 0` and whose `space.parentId
 * === null` upstream. Adding a deeper `parent_id` chain on the server only
 * requires recursive data; the component picks it up without any frontend
 * changes.
 */
function TreeSpace({ space, depth, isOpen, openKeys, onToggle }: TreeSpaceProps) {
  const hasChildSpaces = space.children.length > 0
  const hasOwnContent = space.categories.length > 0 || space.documents.length > 0
  // Every space — top-level and child alike — renders with the same
  // Folder / FolderOpen icon. There is no special "group" treatment; the
  // sidebar is a homogeneous recursive tree.
  const isExpandable = hasChildSpaces || hasOwnContent

  return (
    <div className="group/space">
      <div className={cnflexRow(isOpen)}>
        <TreeToggle
          disabled={!isExpandable}
          open={isOpen}
          onClick={() => onToggle(spaceKey(space.id))}
        />
        <Link
          to="/spaces/$slug"
          params={{ slug: space.slug }}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-sm text-foreground/80 hover:text-foreground [&.active]:font-medium [&.active]:text-accent-foreground"
        >
          {isOpen ? (
            <FolderOpen className="h-4 w-4 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 truncate">{space.name}</span>
        </Link>
        <Link
          to="/documents/new"
          search={{ spaceId: space.id } as never}
          className="mr-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover/space:opacity-100"
          title={`在${space.name}中新建文档`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sr-only">在{space.name}中新建文档</span>
        </Link>
      </div>

      {isOpen && (
        <div className={cnml(depth)}>
          {hasChildSpaces && (
            <div className="space-y-1">
              {space.children.map((child) => (
                // Same `TreeSpace` component, depth+1. There is no separate
                // "child" renderer — this single component handles every
                // depth recursively.
                <TreeSpace
                  key={child.id}
                  space={child}
                  depth={depth + 1}
                  isOpen={openKeys.has(spaceKey(child.id))}
                  openKeys={openKeys}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}
          {hasOwnContent && (
            <div className="space-y-1">
              {space.categories.map((category) => (
                <div key={category.id} className="group/category">
                  <div className="flex items-center gap-1 rounded-md hover:bg-secondary">
                    <TreeToggle
                      disabled={category.documents.length === 0}
                      open={openKeys.has(categoryKey(category.id))}
                      onClick={() => onToggle(categoryKey(category.id))}
                    />
                    <Link
                      to="/spaces/$slug"
                      params={{ slug: space.slug }}
                      search={{ category: category.slug }}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-[13px] text-foreground/75 hover:text-foreground [&.active]:font-medium [&.active]:text-accent-foreground"
                    >
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        <Folder className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 truncate">{category.name}</span>
                      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                        {category.documents.length}
                      </span>
                    </Link>
                    <Link
                      to="/documents/new"
                      search={{ spaceId: space.id, categoryId: category.id } as never}
                      className="mr-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover/category:opacity-100"
                      title={`在${category.name}中新建文档`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="sr-only">在{category.name}中新建文档</span>
                    </Link>
                  </div>
                  {openKeys.has(categoryKey(category.id)) && category.documents.length > 0 && (
                    <div className="ml-5 space-y-0.5 border-l border-border/60 pl-2 py-0.5">
                      {category.documents.map((document) => (
                        <SidebarLink
                          key={document.id}
                          to="/documents/$slug"
                          params={{ slug: document.slug }}
                          compact
                          icon={<FileText className="h-3.5 w-3.5" />}
                        >
                          {document.title}
                        </SidebarLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {space.documents.map((document) => (
                <SidebarLink
                  key={document.id}
                  to="/documents/$slug"
                  params={{ slug: document.slug }}
                  compact
                  icon={<FileText className="h-3.5 w-3.5" />}
                >
                  {document.title}
                </SidebarLink>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SidebarLink({
  to,
  params,
  search,
  icon,
  children,
  compact = false,
}: {
  to: string
  params?: Record<string, string>
  search?: Record<string, string>
  icon: ReactNode
  children: ReactNode
  compact?: boolean
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      className={cn(
        'flex items-center gap-2 rounded-md px-2.5 text-sm text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-accent [&.active]:font-medium [&.active]:text-accent-foreground',
        compact ? 'py-1.5 text-[13px]' : 'py-1.5',
      )}
      activeProps={{
        className:
          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm bg-accent font-medium text-accent-foreground',
      }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  )
}

function TreeToggle({
  disabled,
  open,
  onClick,
}: {
  disabled: boolean
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground',
        disabled && 'pointer-events-none opacity-0',
      )}
      aria-label={open ? '折叠' : '展开'}
    >
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  )
}

function collectActiveTreeKeys(spaces: SpaceTreeItem[], pathname: string): string[] {
  const keys: string[] = []
  walk(spaces, pathname, keys)
  return keys
}

function walk(nodes: SpaceTreeItem[], pathname: string, keys: string[]): void {
  for (const space of nodes) {
    if (pathname === `/spaces/${space.slug}`) keys.push(spaceKey(space.id))
    for (const document of space.documents) {
      if (pathname === `/documents/${document.slug}`) keys.push(spaceKey(space.id))
    }
    for (const category of space.categories) {
      for (const document of category.documents) {
        if (pathname === `/documents/${document.slug}`) {
          keys.push(spaceKey(space.id), categoryKey(category.id))
        }
      }
    }
    if (space.children.length > 0) walk(space.children, pathname, keys)
  }
}

function spaceKey(id: string) {
  return `space:${id}`
}

function categoryKey(id: string) {
  return `category:${id}`
}

// Per-row indent. Top-level space blocks wear a thin left guide rail so the
// tree reads as a single vertical menu; deeper rows just nudge right by a
// fixed amount so arbitrarily nested spaces don't push the document title
// off-screen.
function cnml(depth: number): string {
  if (depth === 0) return 'ml-3.5 border-l border-border/80 pl-2 space-y-1'
  return 'ml-4 space-y-1'
}

function cnflexRow(isOpen: boolean): string {
  return cn(
    'flex items-center gap-1 rounded-md hover:bg-secondary',
    isOpen ? 'text-foreground' : 'text-foreground/80',
  )
}
