import { Link } from '@tanstack/react-router'
import { Hash } from 'lucide-react'

export function TagPill({ name }: { name: string }) {
  return (
    <Link
      to="/tags/$slug"
      params={{ slug: name }}
      className="inline-flex items-center gap-0.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Hash className="h-3 w-3 opacity-60" />
      {name}
    </Link>
  )
}
