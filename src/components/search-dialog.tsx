import { Link } from '@tanstack/react-router'
import { FilePlus2, FileText, Hash, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { searchDocuments } from '~/server/documents'
import type { DocumentSummary } from '~/shared/types'

type Props = {
  popularTags?: Array<{ name: string; slug: string }>
}

export function SearchDialog({ popularTags = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DocumentSummary[]>([])
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    const id = window.setTimeout(() => {
      startTransition(async () => {
        const response = await searchDocuments({ data: { query: q, page: 1, pageSize: 8 } })
        setResults(response.items)
      })
    }, 180)
    return () => window.clearTimeout(id)
  }, [query])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          title="搜索"
          className="h-9 w-9 rounded-md px-0 text-foreground/75 hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:ring-0 sm:w-64 sm:justify-start sm:px-3"
        >
          <Search className="h-4 w-4" />
          <span className="hidden flex-1 text-left text-sm font-normal text-muted-foreground sm:inline">
            搜索知识库
          </span>
          <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="search-dialog border-transparent shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
        <DialogHeader className="sr-only">
          <DialogTitle>搜索</DialogTitle>
          <DialogDescription>搜索文档、标签、空间或分类</DialogDescription>
        </DialogHeader>

        <div className="flex items-center border-b border-border/60 px-5">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文档、标签、空间或分类"
            className="h-16 border-0 bg-transparent pl-4 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {query.trim() ? (
            <div className="space-y-1">
              {pending && results.length === 0 ? (
                <div className="rounded-md bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
                  正在搜索...
                </div>
              ) : results.length > 0 ? (
                results.map((document) => (
                  <Link
                    key={document.id}
                    to="/documents/$slug"
                    params={{ slug: document.slug }}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{document.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {document.space?.name ?? '未分配空间'}
                          {document.category ? ` / ${document.category.name}` : ''}
                        </div>
                        {document.excerpt && (
                          <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {document.excerpt}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-md bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
                  没有找到相关文档
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <section>
                <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  快捷入口
                </div>
                <Link
                  to="/documents/new"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary"
                >
                  <FilePlus2 className="h-4 w-4 text-muted-foreground" />
                  新建文档
                </Link>
                <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  支持搜索标题、摘要和正文
                </div>
              </section>

              {popularTags.length > 0 && (
                <section>
                  <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    热门标签
                  </div>
                  <div className="space-y-1">
                    {popularTags.slice(0, 8).map((tag) => (
                      <Link
                        key={tag.slug}
                        to="/tags/$slug"
                        params={{ slug: tag.slug }}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary"
                      >
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        {tag.name}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}
