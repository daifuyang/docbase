import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Nav } from '~/components/nav'
import { Sidebar } from '~/components/sidebar'
import { getCurrentUser } from '~/server/auth'
import { getNavigationTree } from '~/server/spaces'
import { listTags } from '~/server/tags'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ location }) => {
    const me = await getCurrentUser()
    if (!me) {
      throw redirect({
        to: '/auth/login',
        search: { redirect: location.href },
      })
    }
    return { me }
  },
  loader: async () => {
    const [tags, navigation] = await Promise.all([
      listTags({ data: { limit: 12 } }),
      getNavigationTree(),
    ])
    return {
      tags: tags.items,
      spaces: navigation.items,
      expandedKeys: navigation.expandedKeys,
    }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  const { me } = Route.useRouteContext()
  const { tags, spaces, expandedKeys } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-background">
      <Nav me={me} tags={tags} spaces={spaces} expandedKeys={expandedKeys} />
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1920px]">
        <Sidebar
          popularTags={tags}
          spaces={spaces}
          expandedKeys={expandedKeys}
          className="hidden border-r border-border bg-surface/70 lg:block xl:w-72"
          contentClassName="sticky top-20 p-4 xl:p-5"
        />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
