'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { KnowledgeTreeNode } from '~/components/knowledge/KnowledgeTreeNode'
import type { KnowledgeNode, KnowledgeNodeAction } from '~/components/knowledge/types'
import { cn } from '~/lib/utils'

type Props = {
  nodes: KnowledgeNode[]
  /** Node ids expanded on first render. Folder state after that is local. */
  defaultOpenIds?: string[]
  /** Allowed to create folders. Kept as a prop so a read-only tree is trivial. */
  canCreate?: boolean
  /** Container id that should immediately show an inline "new folder" row. */
  pendingFolderParentId?: string | null
  /** Called once a pending request has been consumed or dismissed. */
  onPendingFolderHandled?: () => void
  onNodeAction?: (node: KnowledgeNode, action: KnowledgeNodeAction) => void
}

/**
 * Feishu-style knowledge tree.
 *
 * Expansion state lives here rather than in the shared navigation-tree store:
 * this tree is driven by its own view model and its nodes are not the same
 * entities the navigation store persists, so mixing the two would produce an
 * inconsistent snapshot. A later stage can swap this for the shared store once
 * the tree is backed by server data.
 *
 * Folder creation is local: creating appends a mock node to the tree so the
 * interaction can be reviewed end to end before persistence exists.
 *
 * `pendingFolderParentId` is controllable from outside so the section-header
 * create menu can open the inline row too, instead of duplicating the input in
 * two places.
 */
export function KnowledgeTree({
  nodes,
  defaultOpenIds = [],
  canCreate = true,
  pendingFolderParentId: controlledPendingParentId,
  onPendingFolderHandled,
  onNodeAction,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(defaultOpenIds))
  const [extraChildren, setExtraChildren] = useState<Record<string, KnowledgeNode[]>>({})
  const [localPendingParentId, setLocalPendingParentId] = useState<string | null>(null)

  const pendingFolderParentId = controlledPendingParentId ?? localPendingParentId

  const isOpen = useCallback((id: string) => expandedIds.has(id), [expandedIds])

  const expand = useCallback((id: string) => {
    setExpandedIds((current) => (current.has(id) ? current : new Set(current).add(id)))
  }, [])

  const toggle = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearPending = useCallback(() => {
    setLocalPendingParentId(null)
    onPendingFolderHandled?.()
  }, [onPendingFolderHandled])

  const requestNewFolder = useCallback(
    (parentId: string) => {
      setLocalPendingParentId(parentId)
      // Make sure the target container is open, otherwise the new row has no
      // visible home and the user would have to expand the node to find it.
      expand(parentId)
    },
    [expand],
  )

  // A container asked for from outside may not be expanded yet.
  useEffect(() => {
    if (controlledPendingParentId) expand(controlledPendingParentId)
  }, [controlledPendingParentId, expand])

  const cancelNewFolder = useCallback(() => clearPending(), [clearPending])

  const submitNewFolder = useCallback(
    (parentId: string, name: string) => {
      // The id is derived inside the state updater so rapid successive creates
      // cannot read the same sibling count and collide.
      setExtraChildren((current) => {
        const siblings = current[parentId] ?? []
        const id = `folder-new-${parentId}-${siblings.length + 1}`
        return {
          ...current,
          [parentId]: [...siblings, { id, name, type: 'folder', children: [] }],
        }
      })
      setLocalPendingParentId(null)
      onPendingFolderHandled?.()
    },
    [onPendingFolderHandled],
  )

  // Merge locally-created folders into the incoming tree once, so a re-render
  // never rebuilds the structure or drops the mock nodes.
  const mergedNodes = useMemo(
    () => mergeExtraChildren(nodes, extraChildren),
    [nodes, extraChildren],
  )

  const handleNodeAction = useCallback(
    (node: KnowledgeNode, action: KnowledgeNodeAction) => {
      onNodeAction?.(node, action)
    },
    [onNodeAction],
  )

  return (
    <div className="space-y-0.5">
      {mergedNodes.map((node) => (
        <KnowledgeTreeNode
          key={node.id}
          node={node}
          depth={0}
          isOpen={isOpen}
          onToggle={toggle}
          pendingFolderParentId={canCreate ? pendingFolderParentId : null}
          onRequestNewFolder={requestNewFolder}
          onSubmitNewFolder={submitNewFolder}
          onCancelNewFolder={cancelNewFolder}
          onNodeAction={handleNodeAction}
          indentClassName={indentClassName}
        />
      ))}
    </div>
  )
}

/**
 * Appends locally-created children to their parent, recursively.
 *
 * Structural sharing is deliberate: untouched subtrees keep their identity, so
 * only the branch that actually changed re-renders.
 */
function mergeExtraChildren(
  nodes: KnowledgeNode[],
  extra: Record<string, KnowledgeNode[]>,
): KnowledgeNode[] {
  if (Object.keys(extra).length === 0) return nodes

  let changed = false
  const next = nodes.map((node) => {
    const additions = extra[node.id]
    const mergedChildren = node.children ? mergeExtraChildren(node.children, extra) : node.children
    const childrenChanged = mergedChildren !== node.children

    if (!additions && !childrenChanged) return node

    changed = true
    return { ...node, children: [...(mergedChildren ?? []), ...(additions ?? [])] }
  })

  return changed ? next : nodes
}

/**
 * Per-level indent. The first level wears a thin guide rail so the tree reads
 * as one vertical menu; deeper levels just nudge right by a fixed amount so a
 * long folder name never pushes the label off-screen.
 */
function indentClassName(depth: number): string {
  if (depth === 0) return 'ml-3.5 space-y-0.5 border-l border-border/80 pl-2'
  return cn('ml-4 space-y-0.5')
}
