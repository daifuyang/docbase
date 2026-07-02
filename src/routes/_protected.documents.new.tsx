import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DocumentForm } from '~/components/document-form'
import { listCategoriesBySpace, listSpaces } from '~/server/spaces'

export const Route = createFileRoute('/_protected/documents/new')({
  validateSearch: z.object({
    spaceId: z.string().optional(),
    categoryId: z.string().optional(),
  }),
  loader: async ({ deps }: { deps: { spaceId?: string; categoryId?: string } }) => {
    const spaces = await listSpaces()
    const categoryGroups = await Promise.all(
      spaces.items.map((space) => listCategoriesBySpace({ data: { spaceId: space.id } })),
    )
    return {
      spaces: spaces.items,
      categories: categoryGroups.flatMap((group) => group.items),
      initialSpaceId: deps.spaceId,
      initialCategoryId: deps.categoryId,
    }
  },
  loaderDeps: ({ search }) => ({ spaceId: search.spaceId, categoryId: search.categoryId }),
  component: NewDocumentPage,
})

function NewDocumentPage() {
  const { spaces, categories, initialSpaceId, initialCategoryId } = Route.useLoaderData()
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 2xl:px-8">
      <header className="mb-5 border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">新建文档</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          先写清楚内容，再设置空间、分类和标签，发布后团队成员即可检索。
        </p>
      </header>
      <DocumentForm
        spaces={spaces}
        categories={categories}
        initialSpaceId={initialSpaceId}
        initialCategoryId={initialCategoryId}
      />
    </div>
  )
}
