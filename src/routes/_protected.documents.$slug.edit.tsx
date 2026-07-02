import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { DocumentForm } from '~/components/document-form'
import { getDocumentBySlug } from '~/server/documents'
import { listCategoriesBySpace, listSpaces } from '~/server/spaces'
import type { TipTapDoc } from '~/shared/types'

export const Route = createFileRoute('/_protected/documents/$slug/edit')({
  beforeLoad: async ({ context, params }) => {
    const { me } = context
    const document = await getDocumentBySlug({ data: { slug: params.slug } })
    if (!document) throw notFound()
    if (document.creator.id !== me.id) {
      throw redirect({ to: '/documents/$slug', params: { slug: params.slug } })
    }
    return { me, document }
  },
  loader: async ({ params }) => {
    const [document, spaces] = await Promise.all([
      getDocumentBySlug({ data: { slug: params.slug } }),
      listSpaces(),
    ])
    if (!document) throw notFound()
    const categoryGroups = await Promise.all(
      spaces.items.map((space) => listCategoriesBySpace({ data: { spaceId: space.id } })),
    )
    return {
      initial: {
        id: document.id,
        title: document.title,
        contentJson: document.contentJson ?? ({ type: 'doc' as const, content: [] } as TipTapDoc),
        tags: document.tags,
        status: document.status,
        spaceId: document.space?.id,
        categoryId: document.category?.id ?? null,
      },
      spaces: spaces.items,
      categories: categoryGroups.flatMap((group) => group.items),
    }
  },
  component: EditDocumentPage,
})

function EditDocumentPage() {
  const { initial, spaces, categories } = Route.useLoaderData()
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 2xl:px-8">
      <header className="mb-5 border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">编辑文档</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          更新正文和归属信息，保持团队知识可搜索、可维护。
        </p>
      </header>
      <DocumentForm initial={initial} spaces={spaces} categories={categories} />
    </div>
  )
}
