import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { FolderOpen, Layers3, ShieldCheck, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState, useTransition } from 'react'
import { createMember, getCurrentUser, listMembers } from '~/server/auth'
import { createCategory, createSpace, listCategories, listSpaces } from '~/server/spaces'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const me = await getCurrentUser()
    if (!me) throw redirect({ to: '/auth/login' })
    if (me.role !== 'admin') throw redirect({ to: '/' })
    return { me }
  },
  loader: async () => {
    const [members, spaces, categories] = await Promise.all([
      listMembers(),
      listSpaces(),
      listCategories(),
    ])
    return { members: members.items, spaces: spaces.items, categories: categories.items }
  },
  component: AdminPage,
})

function AdminPage() {
  const { members, spaces, categories } = Route.useLoaderData()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 2xl:px-8">
      <header className="mb-6 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">知识库管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              维护成员、空间和分类，保持知识入口稳定。
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <main className="space-y-4">
          <section className="rounded-lg border border-border bg-surface">
            <SectionHeader
              icon={<Users className="h-4 w-4" />}
              title="成员"
              meta={`${members.length} 人`}
            />
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {member.displayName ?? member.username}
                    </div>
                    <div className="text-xs text-muted-foreground">@{member.username}</div>
                  </div>
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                    {member.role === 'admin' ? '管理员' : '成员'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <SectionHeader
              icon={<FolderOpen className="h-4 w-4" />}
              title="空间与分类"
              meta={`${spaces.length} 个空间 / ${categories.length} 个分类`}
            />
            <div className="divide-y divide-border">
              {spaces.map((space) => {
                const childCategories = categories.filter(
                  (category) => category.spaceId === space.id,
                )
                return (
                  <div key={space.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{space.name}</div>
                        {space.description && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {space.description}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {childCategories.length} 个分类
                      </span>
                    </div>
                    {childCategories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {childCategories.map((category) => (
                          <span
                            key={category.id}
                            className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <CreateMemberPanel />
          <CreateSpacePanel />
          <CreateCategoryPanel spaces={spaces} />
        </aside>
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  meta,
}: {
  icon: ReactNode
  title: string
  meta: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <span className="text-xs text-muted-foreground">{meta}</span>
    </div>
  )
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
    />
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
    >
      {pending ? '提交中...' : children}
    </button>
  )
}

function CreateMemberPanel() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <Panel icon={<UserPlus className="h-4 w-4" />} title="创建成员">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          setError('')
          startTransition(async () => {
            try {
              await createMember({
                data: {
                  email: String(form.get('email') ?? ''),
                  username: String(form.get('username') ?? ''),
                  displayName: String(form.get('displayName') ?? '') || undefined,
                  password: String(form.get('password') ?? ''),
                },
              })
              event.currentTarget.reset()
              await router.invalidate()
            } catch (err) {
              setError(err instanceof Error ? err.message : '创建失败')
            }
          })
        }}
      >
        <Field name="email" type="email" placeholder="邮箱" required />
        <Field name="username" placeholder="用户名" required minLength={3} />
        <Field name="displayName" placeholder="显示名称" />
        <Field name="password" type="password" placeholder="初始密码" required minLength={8} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <SubmitButton pending={pending}>创建成员</SubmitButton>
      </form>
    </Panel>
  )
}

function CreateSpacePanel() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <Panel icon={<FolderOpen className="h-4 w-4" />} title="创建空间">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          setError('')
          startTransition(async () => {
            try {
              await createSpace({
                data: {
                  name: String(form.get('name') ?? ''),
                  description: String(form.get('description') ?? '') || undefined,
                },
              })
              event.currentTarget.reset()
              await router.invalidate()
            } catch (err) {
              setError(err instanceof Error ? err.message : '创建失败')
            }
          })
        }}
      >
        <Field name="name" placeholder="空间名称" required />
        <Field name="description" placeholder="空间说明" />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <SubmitButton pending={pending}>创建空间</SubmitButton>
      </form>
    </Panel>
  )
}

function CreateCategoryPanel({ spaces }: { spaces: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <Panel icon={<Layers3 className="h-4 w-4" />} title="创建分类">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          setError('')
          startTransition(async () => {
            try {
              await createCategory({
                data: {
                  spaceId: String(form.get('spaceId') ?? ''),
                  name: String(form.get('name') ?? ''),
                  description: String(form.get('description') ?? '') || undefined,
                },
              })
              event.currentTarget.reset()
              await router.invalidate()
            } catch (err) {
              setError(err instanceof Error ? err.message : '创建失败')
            }
          })
        }}
      >
        <select
          name="spaceId"
          required
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">选择空间</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
        <Field name="name" placeholder="分类名称" required />
        <Field name="description" placeholder="分类说明" />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <SubmitButton pending={pending}>创建分类</SubmitButton>
      </form>
    </Panel>
  )
}
