import { QueryClientProvider } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Nav } from '~/components/nav'
import { Sidebar } from '~/components/sidebar'
import { queryClient } from '~/router'
import { getCurrentUser } from '~/server/auth'
import { getInstallState } from '~/server/install'
import { getNavigationTree } from '~/server/spaces'
import { listTags } from '~/server/tags'
import '~/styles/globals.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'DocBase — 企业知识库' },
      { name: 'description', content: 'DocBase — 团队知识沉淀与分享平台' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
  }),
  beforeLoad: async ({ location }) => {
    const installState = await getInstallState()
    const publicPaths = ['/install', '/swagger', '/api/health']
    if (installState.status !== 'ready' && !publicPaths.includes(location.pathname)) {
      throw redirect({ to: '/install' })
    }
  },
  loader: async () => {
    const installState = await getInstallState()
    if (installState.status !== 'ready') {
      return {
        installState,
        me: null,
        tags: [],
        spaces: [],
        expandedKeys: [],
      }
    }
    // getCurrentUser() returns null for anonymous requests (see
    // getCurrentUserService). Child routes decide whether to redirect
    // (e.g. index.tsx → /auth/login). Don't throw here — otherwise the
    // error boundary would intercept before the child route's
    // beforeLoad redirect can run.
    const me = await getCurrentUser()
    const [tags, navigation] = me
      ? await Promise.all([listTags({ data: { limit: 12 } }), getNavigationTree()])
      : [{ items: [] }, { items: [], expandedKeys: [] }]
    return {
      installState,
      me,
      tags: tags.items,
      spaces: navigation.items,
      expandedKeys: navigation.expandedKeys,
    }
  },
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
})

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAuthRoute = pathname.startsWith('/auth/')
  const isInstallRoute = pathname === '/install'
  const data = Route.useLoaderData()

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        {isAuthRoute || isInstallRoute ? (
          <Outlet />
        ) : (
          <div className="min-h-screen bg-background">
            <Nav />
            <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1920px]">
              <Sidebar
                popularTags={data.tags}
                spaces={data.spaces}
                expandedKeys={data.expandedKeys}
                className="hidden border-r border-border bg-surface/70 lg:block xl:w-72"
                contentClassName="sticky top-20 p-4 xl:p-5"
              />
              <main className="min-w-0 flex-1">
                <Outlet />
              </main>
            </div>
          </div>
        )}
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeInitScript />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function ThemeInitScript() {
  const code = `
try {
  var theme = window.localStorage.getItem('docbase-theme');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }
} catch (_) {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'light';
}
`

  // biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap script contains no user input.
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl font-bold text-muted-foreground/30">404</div>
      <h1 className="mt-4 text-2xl font-semibold">页面不存在</h1>
      <p className="mt-2 text-muted-foreground">您访问的页面已被移除或链接失效</p>
      <a
        href="/"
        className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        回到首页
      </a>
    </div>
  )
}

function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-destructive">出错了</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{error.message}</p>
      <a
        href="/"
        className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        回到首页
      </a>
    </div>
  )
}
