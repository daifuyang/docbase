import { Link } from '@tanstack/react-router'
import { FolderOpen } from 'lucide-react'
import type { DocumentSummary } from '~/shared/types'
import { TagPill } from './tag-pill'

type Props = {
  document: DocumentSummary
  variant?: 'default' | 'compact'
}

export function DocumentCard({ document, variant = 'default' }: Props) {
  if (variant === 'compact') {
    return (
      <Link
        to="/documents/$slug"
        params={{ slug: document.slug }}
        className="group block rounded-md px-2 py-2 transition-colors hover:bg-secondary"
      >
        <div className="line-clamp-1 text-sm font-medium group-hover:text-primary">
          {document.title}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(document.updatedAt)}</div>
      </Link>
    )
  }

  return (
    <article className="group border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-muted/70">
      <div className="min-w-0">
        <h2 className="text-base font-medium leading-6 tracking-tight">
          <Link
            to="/documents/$slug"
            params={{ slug: document.slug }}
            className="text-foreground transition-colors group-hover:text-primary"
          >
            {document.title}
          </Link>
        </h2>

        {document.excerpt && (
          <p className="mt-1 line-clamp-1 text-sm leading-6 text-muted-foreground">
            {document.excerpt}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/75">
            {document.creator.displayName ?? document.creator.username}
          </span>
          <time dateTime={document.updatedAt}>{formatDate(document.updatedAt)}</time>
          <span
            className={
              document.status === 'draft'
                ? 'rounded-md bg-yellow-100 px-1.5 py-0.5 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200'
                : 'rounded-md bg-accent px-1.5 py-0.5 text-accent-foreground'
            }
          >
            {document.status === 'draft' ? '草稿' : '已发布'}
          </span>
          {document.space && (
            <span className="inline-flex items-center gap-1">
              <FolderOpen className="h-3.5 w-3.5" />
              {document.space.name}
              {document.category ? ` / ${document.category.name}` : ''}
            </span>
          )}
          {document.tags.slice(0, 3).map((tag) => (
            <TagPill key={tag} name={tag} />
          ))}
        </div>
      </div>
    </article>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}
