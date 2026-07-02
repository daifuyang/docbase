import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { docbaseOpenApiSpec } from '~/shared/openapi'

const SwaggerViewer = lazy(() => import('~/components/swagger-viewer'))

export const Route = createFileRoute('/swagger')({
  component: SwaggerPage,
  head: () => ({ meta: [{ title: 'API Docs - DocBase' }] }),
})

function SwaggerPage() {
  return (
    <div style={{ padding: '20px', height: '100vh' }}>
      <Suspense fallback={<SwaggerFallback />}>
        <SwaggerViewer spec={docbaseOpenApiSpec} />
      </Suspense>
    </div>
  )
}

function SwaggerFallback() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
      API 文档加载中...
    </div>
  )
}
