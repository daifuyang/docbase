'use client'

import { useRouter } from '@tanstack/react-router'
import { FolderPlus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { createCategory } from '~/server/spaces'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  spaceId: string
  spaceName: string
  /**
   * Where to land after a successful create. We refresh the surrounding
   * surface so the new folder shows up without forcing the user away from
   * what they were looking at. The default invalidates the active route.
   */
  onCreated?: (result: { id: string; slug: string }) => void
}

/**
 * Modal for creating a folder (category) inside a specific space.
 *
 * The form posts to `createCategory` (already gated by `requireAdmin` on the
 * server). On success we close the dialog and re-run the active route's
 * loader so the sidebar/space page picks up the new category without a full
 * page reload. Errors are surfaced in the dialog so the user can retry.
 */
export function CreateCategoryDialog({ open, onOpenChange, spaceId, spaceName, onCreated }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setName('')
    setDescription('')
    setError('')
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请输入文件夹名称')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        const result = await createCategory({
          data: {
            spaceId,
            name: trimmed,
            description: description.trim() || undefined,
          },
        })
        reset()
        onOpenChange(false)
        if (onCreated) onCreated(result.category)
        else await router.invalidate()
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建失败')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-muted-foreground" />
            新建文件夹
          </DialogTitle>
          <DialogDescription>
            在「{spaceName}」空间下新建一个分类文件夹，用来组织相关文档。
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="space-y-1">
            <label htmlFor="category-name" className="text-xs text-muted-foreground">
              文件夹名称
            </label>
            <Input
              id="category-name"
              autoFocus
              maxLength={60}
              placeholder="例如：接口规范"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="category-desc" className="text-xs text-muted-foreground">
              说明（可选）
            </label>
            <Input
              id="category-desc"
              maxLength={200}
              placeholder="一句话说明这个分类的用途"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? '创建中...' : '创建文件夹'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
