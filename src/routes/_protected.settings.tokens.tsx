import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { createApiKey, listApiKeys, revokeApiKey } from '~/server/auth'
import type { CreateApiKeyInput } from '~/shared/validation/api-key'

export const Route = createFileRoute('/_protected/settings/tokens')({
  loader: async () => listApiKeys(),
  component: TokensPage,
})

function TokensPage() {
  const { items } = Route.useLoaderData()
  const router = useRouter()
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const copyCreatedKey = async () => {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 2xl:px-8">
      <header className="mb-6 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">访问令牌</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              为 Restish、自动化脚本和服务端集成签发个人 API token。
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            创建令牌
          </h2>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              setError('')
              setCreatedKey(null)
              startTransition(async () => {
                try {
                  const result = await createApiKey({
                    data: {
                      name: String(form.get('name') ?? ''),
                      expiration: String(
                        form.get('expiration') ?? '90d',
                      ) as CreateApiKeyInput['expiration'],
                    },
                  })
                  setCreatedKey(result.key)
                  event.currentTarget.reset()
                  await router.invalidate()
                } catch (err) {
                  setError(err instanceof Error ? err.message : '创建失败')
                }
              })
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="token-name" className="text-xs font-medium text-muted-foreground">
                名称
              </label>
              <Input id="token-name" name="name" placeholder="例如：CI 发布脚本" required />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="token-expiration"
                className="text-xs font-medium text-muted-foreground"
              >
                有效期
              </label>
              <select
                id="token-expiration"
                name="expiration"
                defaultValue="90d"
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none"
              >
                <option value="30d">30 天</option>
                <option value="90d">90 天</option>
                <option value="1y">1 年</option>
                <option value="never">永不过期</option>
              </select>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? '创建中...' : '生成新令牌'}
            </Button>
          </form>
        </section>

        <main className="space-y-4">
          {createdKey && (
            <section className="rounded-lg border border-primary/30 bg-surface p-4">
              <div className="mb-2 text-sm font-semibold">请立即保存这个 token</div>
              <p className="mb-3 text-sm text-muted-foreground">
                出于安全考虑，离开此页面后将无法再次查看完整 token。
              </p>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-xs">
                  {createdKey}
                </code>
                <Button type="button" variant="outline" onClick={copyCreatedKey}>
                  <Copy className="h-4 w-4" />
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">已有令牌</h2>
              <span className="text-xs text-muted-foreground">{items.length} 个</span>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                还没有访问令牌
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <TokenRow
                    key={item.id}
                    token={item}
                    onRevoked={async () => {
                      await router.invalidate()
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function TokenRow({
  token,
  onRevoked,
}: {
  token: {
    id: string
    name: string | null
    prefix: string | null
    createdAt: string
    expiresAt: string | null
    lastRequest: string | null
  }
  onRevoked: () => Promise<void>
}) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-medium">{token.name ?? '未命名令牌'}</div>
          {token.prefix && (
            <code className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {token.prefix}...
            </code>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>创建于 {formatDate(token.createdAt)}</span>
          <span>{token.expiresAt ? `过期于 ${formatDate(token.expiresAt)}` : '永不过期'}</span>
          <span>
            {token.lastRequest ? `上次使用 ${formatDate(token.lastRequest)}` : '尚未使用'}
          </span>
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm('确定要撤销这个访问令牌吗？使用它的脚本会立即失效。')
          if (!confirmed) return
          setError('')
          startTransition(async () => {
            try {
              await revokeApiKey({ data: { keyId: token.id } })
              await onRevoked()
            } catch (err) {
              setError(err instanceof Error ? err.message : '撤销失败')
            }
          })
        }}
      >
        <Trash2 className="h-4 w-4" />
        {pending ? '撤销中' : '撤销'}
      </Button>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
