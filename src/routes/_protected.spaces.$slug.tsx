import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ChevronRight, FolderOpen } from 'lucide-react'
import { z } from 'zod'
import { DocumentCard } from '~/components/document-card'
import { listDocuments } from '~/server/documents'
import { listCategoriesBySpace, listSpaces } from '~/server/spaces'

export const Route = createFileRoute('/_protected/spaces/$slug')({
  validateSearch: z.object({
    category: z.string().optional(),
  }),
  loader: async ({ params, deps }: { params: { slug: string }; deps: { category?: string } }) => {
    const spaces = await listSpaces()
    const space = spaces.items.find((item) => item.slug === params.slug)
    if (!space) throw notFound()
    const [categories, documents] = await Promise.all([
      listCategoriesBySpace({ data: { spaceId: space.id } }),
      listDocuments({
        data: {
          page: 1,
          pageSize: 50,
          spaceSlug: params.slug,
          categorySlug: deps.category,
        },
      }),
    ])
    const category = deps.category
      ? categories.items.find((item) => item.slug === deps.category)
      : null
    return { space, categories: categories.items, category, documents }
  },
  loaderDeps: ({ search }) => ({ category: search.category }),
  component: SpacePage,
})

function SpacePage() {
  const { space, categories, category, documents } = Route.useLoaderData()
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 2xl:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          知识首页
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>知识空间</span>
      </nav>

      <header className="mb-5 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-muted-foreground">
            <FolderOpen className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{space.name}</h1>
            {space.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{space.description}</p>
            )}
          </div>
        </div>
        {categories.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/spaces/$slug"
              params={{ slug: space.slug }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{
                className:
                  'rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-foreground',
              }}
            >
              全部
            </Link>
            {categories.map((item) => (
              <Link
                key={item.id}
                to="/spaces/$slug"
                params={{ slug: space.slug }}
                search={{ category: item.slug }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{
                  className:
                    'rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-foreground',
                }}
              >
                {item.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {category && (
        <div className="mb-3 text-sm text-muted-foreground">
          当前分类：<span className="font-medium text-foreground">{category.name}</span>
        </div>
      )}

      {documents.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-8 py-16 text-center text-sm text-muted-foreground">
          这个空间还没有文档
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {documents.items.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      )}
    </div>
  )
}
