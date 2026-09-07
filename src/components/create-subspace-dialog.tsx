'use client'

import { useRouter } from '@tanstack/react-router'
import { FolderTree } from 'lucide-react'
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
import { createSpace } from '~/server/spaces'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentSpaceId: string
  parentSpaceName: string
  /**
   * Where to land after a successful create. The default invalidates the
   * active route so the new child space appears in the sidebar without a
   * full page reload.
   */
  onCreated?: (result: { id: string; slug: string }) => void
}

/**
 * Modal for creating a sub-space under a given parent. Mirrors the file/folder
 * mental model from the main page: a child space is itself a knowledge space
 * that can host its own categories.
 *
 * Server side is `createSpaceService` with `parentId` set; that route is
 * already gated by `requireAdmin`, so we just forward the form payload.
 */
export function CreateSubspaceDialog({
  open,
  onOpenChange,
  parentSpaceId,
  parentSpaceName,
  onCreated,
}: Props) {
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
      setError('请输入子空间名称')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        const result = await createSpace({
          data: {
            name: trimmed,
            description: description.trim() || undefined,
            parentId: parentSpaceId,
          },
        })
        reset()
        onOpenChange(false)
        if (onCreated) onCreated(result.space)
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
            <FolderTree className="h-4 w-4 text-muted-foreground" />
            新建子空间
          </DialogTitle>
          <DialogDescription>
            在「{parentSpaceName}」下创建一个子空间，用于承载与父空间相关但独立的主题。
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
            <label htmlFor="subspace-name" className="text-xs text-muted-foreground">
              子空间名称
            </label>
            <Input
              id="subspace-name"
              autoFocus
              maxLength={60}
              placeholder="例如：基础设施"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="subspace-desc" className="text-xs text-muted-foreground">
              说明（可选）
            </label>
            <Input
              id="subspace-desc"
              maxLength={200}
              placeholder="一句话说明这个子空间的范围"
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
              {pending ? '创建中...' : '创建子空间'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
