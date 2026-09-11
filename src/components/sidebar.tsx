'use client'

import { Link } from '@tanstack/react-router'
import { Home, NotebookPen } from 'lucide-react'
import type { ReactNode } from 'react'
import { KnowledgeSidebar } from '~/components/knowledge/KnowledgeSidebar'
import { cn } from '~/lib/utils'
import type { SpaceTreeItem } from '~/shared/types'

type Props = {
  popularTags?: Array<{ name: string; slug: string }>
  spaces?: SpaceTreeItem[]
  className?: string
  contentClassName?: string
}

export function Sidebar({ popularTags = [], spaces = [], className, contentClassName }: Props) {
  return (
    <aside className={cn('w-64 shrink-0', className)}>
      <SidebarContent popularTags={popularTags} spaces={spaces} className={contentClassName} />
    </aside>
  )
}

export function SidebarContent({ popularTags = [], className }: Props) {
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

      {/*
        The knowledge section is self-contained: it owns its tree, expansion
        state and create menus. The surrounding sidebar only supplies layout, so
        the two stay independently evolvable while the tree moves from mock data
        to server-backed folders.
      */}
      <KnowledgeSidebar />

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
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  )
}
