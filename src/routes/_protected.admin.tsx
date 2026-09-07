import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { ChevronRight, FolderOpen, Layers3, ShieldCheck, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState, useTransition } from 'react'
import { createMember, listMembers } from '~/server/auth'
import { listCategories, listSpaces } from '~/server/spaces'

export const Route = createFileRoute('/_protected/admin')({
  beforeLoad: async ({ context }) => {
    const { me } = context
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
                        <Link
                          to="/spaces/$slug"
                          params={{ slug: space.slug }}
                          className="truncate text-sm font-medium hover:text-primary"
                        >
                          {space.name}
                        </Link>
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
          {/* 空间/分类的创建入口已统一到侧边栏与空间页右上角的「+ 新建」下拉，admin 页面里只保留这两个跳转引导，避免维护两套表单。 */}
          <StructureShortcutPanel spaces={spaces} />
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

/**
 * Replaces the old inline "create space" / "create category" forms. The
 * actual creation lives in the sidebar "+" menu and the space page "+"
 * dropdown — both of which can target any space the admin is currently
 * looking at. We keep the member-creation form here because it has no
 * equivalent surface elsewhere.
 */
function StructureShortcutPanel({
  spaces,
}: {
  spaces: Array<{ id: string; slug: string; name: string }>
}) {
  return (
    <Panel icon={<Layers3 className="h-4 w-4" />} title="空间与分类">
      <p className="text-xs text-muted-foreground">
        创建空间或分类请进入对应空间页，使用右上角「+
        新建」下拉。也可以从左侧栏「知识空间」标题旁的「+」直接新建顶级空间。
      </p>
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
        {spaces.map((space) => (
          <Link
            key={space.id}
            to="/spaces/$slug"
            params={{ slug: space.slug }}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
          >
            <span className="truncate">{space.name}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </Panel>
  )
}
