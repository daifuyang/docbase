'use client'

import { useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { CreateMenu } from '~/components/knowledge/CreateMenu'
import { KnowledgeTree } from '~/components/knowledge/KnowledgeTree'
import { createInitialKnowledgeTree } from '~/components/knowledge/mock-data'
import type { KnowledgeNode, KnowledgeNodeAction } from '~/components/knowledge/types'

type Props = {
  /** Ids expanded on first paint. Defaults to every top-level space. */
  defaultOpenIds?: string[]
}

/**
 * The knowledge section of the sidebar: a section header with an anchored
 * create menu, plus the tree underneath.
 *
 * Layout and typography match the surrounding sidebar sections — the header
 * uses the same uppercase micro-label as "工作区" and "标签筛选".
 */
export function KnowledgeSidebar({ defaultOpenIds }: Props) {
  const navigate = useNavigate()
  // A single tree instance per mount. Seeded with mock data until the backend
  // exposes folders; see `mock-data.ts`.
  const [nodes] = useState<KnowledgeNode[]>(() => createInitialKnowledgeTree())
  // Set when the header menu asks for a folder: the tree owns the inline input,
  // so we only tell it which container should host the new row.
  const [rootFolderParentId, setRootFolderParentId] = useState<string | null>(null)

  const initialOpenIds = defaultOpenIds ?? nodes.map((node) => node.id)

  const handleRootCreate = useCallback(
    (action: 'new-document' | 'new-folder') => {
      if (action === 'new-document') {
        // Documents keep their existing behaviour: open the editor. A later
        // stage can pre-seed the save location from the selected node.
        void navigate({ to: '/documents/new' })
        return
      }
      // A folder has no parent yet, so it lands in the first space — where a
      // user would expect a new top-level folder to appear.
      setRootFolderParentId(nodes[0]?.id ?? null)
    },
    [navigate, nodes],
  )

  const handlePendingFolderHandled = useCallback(() => setRootFolderParentId(null), [])

  const handleNodeAction = useCallback((node: KnowledgeNode, action: KnowledgeNodeAction) => {
    // Wiring for these actions lands in a later stage; reporting the intent is
    // enough to verify the menu is reachable for every node type.
    console.warn('[knowledge] node action', { id: node.id, name: node.name, action })
  }, [])

  return (
    <nav className="space-y-1">
      <div className="flex items-center justify-between px-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          知识空间
        </div>
        <CreateMenu onAction={handleRootCreate} label="新建" />
      </div>
      <KnowledgeTree
        nodes={nodes}
        defaultOpenIds={initialOpenIds}
        pendingFolderParentId={rootFolderParentId}
        onPendingFolderHandled={handlePendingFolderHandled}
        onNodeAction={handleNodeAction}
      />
    </nav>
  )
}
