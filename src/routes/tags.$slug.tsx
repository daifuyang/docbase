import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ChevronRight, Hash } from 'lucide-react'
import { DocumentCard } from '~/components/document-card'
import { listDocuments } from '~/server/documents'

export const Route = createFileRoute('/tags/$slug')({
  loader: async ({ params }) => {
    const result = await listDocuments({ data: { page: 1, pageSize: 50, tagSlug: params.slug } })
    if (result.total === 0) throw notFound()
    return { tag: params.slug, documents: result }
  },
  head: ({ params }) => ({
    meta: [
      { title: `#${params.slug} — DocBase` },
      { name: 'description', content: `标签 #${params.slug} 下的所有文档` },
    ],
  }),
  component: TagPage,
})

function TagPage() {
  const { tag, documents } = Route.useLoaderData()

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8 sm:px-6 2xl:px-8">
      <main className="min-w-0 flex-1">
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            首页
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>标签</span>
        </nav>

        <header className="mb-6 rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Hash className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{tag}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                共 <span className="font-semibold text-foreground">{documents.total}</span>{' '}
                篇相关文档
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-3">
          {documents.items.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      </main>
    </div>
  )
}
