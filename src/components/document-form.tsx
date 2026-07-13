'use client'

import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, FileText, FolderOpen, Save, Send, Tags } from 'lucide-react'
import type { ReactNode } from 'react'
import { Suspense, lazy, useMemo, useState, useTransition } from 'react'
import { TagInput } from '~/components/tag-input'
import { freezeAggregates } from '~/lib/table-aggregate'
import { cn } from '~/lib/utils'
import { createDocument, updateDocument } from '~/server/documents'
import type { CategorySummary, DocumentDetail, SpaceSummary, TipTapDoc } from '~/shared/types'

const Editor = lazy(() =>
  import('~/components/editor/editor').then((module) => ({ default: module.Editor })),
)

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error !== 'object' || error === null) return undefined
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}

type Props = {
  initial?: {
    id: string
    title: string
    contentJson: TipTapDoc
    tags: string[]
    status: 'draft' | 'published'
    spaceId?: string
    categoryId?: string | null
  }
  spaces?: SpaceSummary[]
  categories?: CategorySummary[]
  initialSpaceId?: string
  initialCategoryId?: string | null
}

export function DocumentForm({
  initial,
  spaces = [],
  categories = [],
  initialSpaceId,
  initialCategoryId,
}: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [contentJson, setContentJson] = useState<TipTapDoc>(
    initial?.contentJson ?? { type: 'doc', content: [] },
  )
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [spaceId, setSpaceId] = useState(initial?.spaceId ?? initialSpaceId ?? spaces[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? initialCategoryId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'draft' | 'published' | null>(null)
  const [pending, startTransition] = useTransition()

  const filteredCategories = useMemo(
    () => categories.filter((category) => !spaceId || category.spaceId === spaceId),
    [categories, spaceId],
  )
  const selectedSpace = spaces.find((space) => space.id === spaceId)
  const selectedCategory = categories.find((category) => category.id === categoryId)

  const submit = (status: 'draft' | 'published') => {
    setError(null)
    if (!title.trim()) return setError('请输入文档标题')
    if (!contentJson.content || contentJson.content.length === 0) return setError('请输入正文')
    if (!spaceId) return setError('请选择知识空间')

    // Freeze aggregate numbers into the JSON so SSR/no-JS readers see the
    // correct values. The editor itself never has to re-render them — the
    // reading view will recompute on hydrate and overwrite via data-computed.
    const frozenJson = freezeAggregates(contentJson) as TipTapDoc
    const serializedSize = JSON.stringify(frozenJson).length
    if (serializedSize > 200 * 1024) {
      return setError('正文超过 200KB，无法保存')
    }

    setPendingAction(status)
    startTransition(async () => {
      try {
        const payload = {
          title,
          contentJson: frozenJson,
          tags,
          status,
          spaceId,
          categoryId: categoryId || null,
        }
        const result = (
          initial
            ? await updateDocument({ data: { id: initial.id, ...payload } })
            : await createDocument({ data: payload })
        ) as { document: DocumentDetail }
        navigate({ to: '/documents/$slug', params: { slug: result.document.slug } })
      } catch (error: unknown) {
        setError(getErrorMessage(error) ?? '保存失败')
      } finally {
        setPendingAction(null)
      }
    })
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <main className="min-w-0 space-y-4">
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div
          className={cn(
            'flex items-stretch overflow-hidden rounded-md border bg-surface transition-colors',
            title.length >= 50
              ? 'border-destructive focus-within:border-destructive focus-within:ring-1 focus-within:ring-destructive/30'
              : 'border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30',
          )}
        >
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="输入一个可以被搜索和复用的标题"
            maxLength={50}
            aria-invalid={title.length >= 50 ? 'true' : undefined}
            className={cn(
              'min-w-0 flex-1 bg-transparent px-3 py-2 text-2xl font-bold tracking-tight outline-none placeholder:font-normal placeholder:text-muted-foreground/60',
              title.length >= 50
                ? 'text-destructive placeholder:text-destructive/40'
                : 'text-foreground',
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              'flex shrink-0 select-none items-center pr-3 text-xs tabular-nums',
              title.length >= 50 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {title.length} / 50
          </span>
        </div>

        <Suspense fallback={<EditorFallback />}>
          <Editor value={contentJson} onChange={setContentJson} placeholder="开始编写团队文档..." />
        </Suspense>
      </main>

      <aside className="space-y-4">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            发布检查
          </h2>
          <div className="space-y-2 text-sm">
            <CheckItem active={Boolean(title.trim())}>标题清晰</CheckItem>
            <CheckItem active={Boolean(spaceId)}>已选择空间</CheckItem>
            <CheckItem active={Boolean(contentJson.content?.length)}>正文不为空</CheckItem>
          </div>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => submit('published')}
              disabled={pending}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {pendingAction === 'published' ? '发布中...' : '发布文档'}
            </button>
            <button
              type="button"
              onClick={() => submit('draft')}
              disabled={pending}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {pendingAction === 'draft' ? '保存中...' : '保存草稿'}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FolderOpen className="h-4 w-4" />
            知识归属
          </h2>
          <label className="space-y-1.5 text-sm font-medium">
            <span>空间</span>
            <select
              value={spaceId}
              onChange={(event) => {
                setSpaceId(event.target.value)
                setCategoryId('')
              }}
              className="h-10 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none"
            >
              <option value="">请选择知识空间</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block space-y-1.5 text-sm font-medium">
            <span>分类</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-10 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none"
            >
              <option value="">不选择分类</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
            {selectedSpace?.name ?? '未选择空间'}
            {selectedCategory ? ` / ${selectedCategory.name}` : ''}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Tags className="h-4 w-4" />
            标签
          </h2>
          <TagInput value={tags} onChange={setTags} />
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <FileText className="h-4 w-4" />
            文档状态
          </div>
          {initial?.status === 'published'
            ? '当前为已发布文档，保存草稿会将状态切换为草稿。'
            : '当前文档尚未发布，草稿仅创建者可见。'}
        </section>
      </aside>
    </div>
  )
}

function EditorFallback() {
  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        {Array.from({ length: 11 }).map((_, index) => (
          <div key={index} className="h-8 w-8 rounded-md bg-surface-muted" aria-hidden="true" />
        ))}
      </div>
      <div className="min-h-[320px] p-4">
        <div className="h-4 w-52 rounded bg-surface-muted" />
        <div className="mt-4 h-4 w-full max-w-2xl rounded bg-surface-muted" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-surface-muted" />
      </div>
    </div>
  )
}

function CheckItem({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{children}</span>
      <span
        className={
          active
            ? 'rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground'
            : 'rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground'
        }
      >
        {active ? '完成' : '待补充'}
      </span>
    </div>
  )
}
