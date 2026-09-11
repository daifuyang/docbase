'use client'

import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, SquarePen } from 'lucide-react'
import { useRef, useState } from 'react'
import { CreateMenu } from '~/components/knowledge/CreateMenu'
import { NodeActionMenu } from '~/components/knowledge/NodeActionMenu'
import type { KnowledgeNode, KnowledgeNodeAction } from '~/components/knowledge/types'
import { isContainer } from '~/components/knowledge/types'
import { cn } from '~/lib/utils'

type Props = {
  node: KnowledgeNode
  depth: number
  isOpen: (id: string) => boolean
  onToggle: (id: string) => void
  /** Node id whose inline "new folder" input is active, if any. */
  pendingFolderParentId: string | null
  onRequestNewFolder: (parentId: string) => void
  onSubmitNewFolder: (parentId: string, name: string) => void
  onCancelNewFolder: () => void
  onNodeAction: (node: KnowledgeNode, action: KnowledgeNodeAction) => void
  /** Depth-indent helper; supplied by the tree so spacing stays consistent. */
  indentClassName: (depth: number) => string
}

/**
 * One row in the knowledge tree plus its subtree.
 *
 * Spaces and folders share a single rendering path — only the icon set and the
 * "more" menu contents differ. Documents are leaves and render as plain rows.
 */
export function KnowledgeTreeNode({
  node,
  depth,
  isOpen,
  onToggle,
  pendingFolderParentId,
  onRequestNewFolder,
  onSubmitNewFolder,
  onCancelNewFolder,
  onNodeAction,
  indentClassName,
}: Props) {
  const container = isContainer(node)
  const expandable = container && hasChildren(node)
  const open = container && isOpen(node.id)
  const isCreatingHere = pendingFolderParentId === node.id

  return (
    <div>
      <div
        className={cn(
          'group/node flex items-center gap-1 rounded-md transition-colors hover:bg-secondary',
          container ? 'text-foreground/85' : 'text-foreground/75',
        )}
      >
        {container ? (
          <ToggleButton
            disabled={!expandable}
            open={open}
            onClick={() => onToggle(node.id)}
            label={node.name}
          />
        ) : (
          // Keeps document rows aligned with their folder siblings, which all
          // start with a toggle gutter.
          <span className="ml-1 h-5 w-5 shrink-0" aria-hidden="true" />
        )}

        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1',
            container ? 'text-[13px]' : 'text-[13px]',
          )}
        >
          <NodeIcon node={node} open={open} />
          <span className="truncate">{node.name}</span>
        </span>

        <div className="mr-1 flex items-center gap-0.5">
          {node.type === 'document' && (
            <button
              type="button"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
                'opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100',
              )}
              title={`编辑${node.name}`}
              aria-label={`编辑${node.name}`}
              onClick={() => onNodeAction(node, 'edit')}
            >
              <SquarePen className="h-3.5 w-3.5" />
            </button>
          )}
          {container && (
            <CreateMenu
              onAction={(action) => {
                if (action === 'new-folder') onRequestNewFolder(node.id)
                else onNodeAction(node, 'new-document')
              }}
              label={`在${node.name}中新建`}
              className="h-6 w-6 opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100"
            />
          )}
          <NodeActionMenu
            nodeType={node.type}
            nodeName={node.name}
            onAction={(action) => onNodeAction(node, action)}
          />
        </div>
      </div>

      {open && (
        <div className={indentClassName(depth)}>
          <NewFolderInput
            active={isCreatingHere}
            onSubmit={(name) => onSubmitNewFolder(node.id, name)}
            onCancel={onCancelNewFolder}
          />
          {node.children?.map((child) => (
            <KnowledgeTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isOpen={isOpen}
              onToggle={onToggle}
              pendingFolderParentId={pendingFolderParentId}
              onRequestNewFolder={onRequestNewFolder}
              onSubmitNewFolder={onSubmitNewFolder}
              onCancelNewFolder={onCancelNewFolder}
              onNodeAction={onNodeAction}
              indentClassName={indentClassName}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NodeIcon({ node, open }: { node: KnowledgeNode; open: boolean }) {
  if (node.type === 'document') {
    return <FileText className="h-3.5 w-3.5 shrink-0" />
  }
  if (node.type === 'space') {
    return open ? (
      <FolderOpen className="h-4 w-4 shrink-0" />
    ) : (
      <Folder className="h-4 w-4 shrink-0" />
    )
  }
  return <Folder className="h-3.5 w-3.5 shrink-0" />
}

function hasChildren(node: KnowledgeNode): boolean {
  return (node.children?.length ?? 0) > 0
}

function ToggleButton({
  disabled,
  open,
  onClick,
  label,
}: {
  disabled: boolean
  open: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
        disabled && 'pointer-events-none opacity-0',
      )}
      aria-label={`${open ? '折叠' : '展开'}${label}`}
    >
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  )
}

/**
 * Inline "new folder" row.
 *
 * Inserted directly into the tree instead of opening a dialog: naming a folder
 * is a one-field action, and keeping it in place preserves the user's view of
 * where the folder will land. The parent opens this row by setting
 * `pendingFolderParentId`, which also unmounts nothing else — the input simply
 * appears above the parent's existing children.
 */
function NewFolderInput({
  active,
  onSubmit,
  onCancel,
}: {
  active: boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  // A ref, not state: Escape unmounts this row synchronously via the parent,
  // and the resulting blur fires before any re-render could set a flag.
  const cancelledRef = useRef(false)

  if (!active) return null

  return (
    <div className="py-0.5">
      {/*
        The input owns the whole row so its hit area matches the row above it —
        the folder glyph sits inside the field as an affordance rather than
        stealing horizontal space from the text.
      */}
      <div className="ml-1 flex h-7 w-full items-center gap-1.5 rounded-md border border-primary bg-background px-2">
        <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          // biome-ignore lint/a11y/noAutofocus: the row exists only to be typed into
          autoFocus
          value={name}
          placeholder="文件夹名称"
          aria-label="新建文件夹名称"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const trimmed = name.trim()
              if (!trimmed) return onCancel()
              onSubmit(trimmed)
              setName('')
            } else if (event.key === 'Escape') {
              event.preventDefault()
              cancelledRef.current = true
              onCancel()
            }
          }}
          onBlur={() => {
            if (cancelledRef.current) return
            onCancel()
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
        />
      </div>
    </div>
  )
}
