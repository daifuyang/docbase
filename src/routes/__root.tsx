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
import { useEffect, useState } from 'react'
import { queryClient } from '~/router'
import { getInstallGuardState } from '~/server/install'
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
    const installState = await getInstallGuardState()
    const publicPrefixes = ['/install', '/swagger', '/api/health', '/api/install/']
    const isPublicPath = publicPrefixes.some(
      (path) => location.pathname === path || location.pathname.startsWith(path),
    )
    if (installState.status !== 'ready' && !isPublicPath) {
      throw redirect({ to: '/install' })
    }
  },
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
})

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <RouteProgress />
        <Outlet />
      </QueryClientProvider>
    </RootDocument>
  )
}

function RouteProgress() {
  const isPending = useRouterState({ select: (state) => state.status === 'pending' })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isPending) {
      setVisible(false)
      return
    }
    const timer = window.setTimeout(() => setVisible(true), 120)
    return () => window.clearTimeout(timer)
  }, [isPending])

  return (
    <div
      className={`route-progress fixed left-0 top-0 z-50 h-0.5 w-full bg-primary shadow-[0_0_12px_rgba(22,119,255,0.55)] ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    />
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
