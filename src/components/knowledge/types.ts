/**
 * Node model for the knowledge sidebar tree.
 *
 * This is intentionally a *view* model, decoupled from the server DTOs
 * (`SpaceTreeItem` etc.). Folder organisation is front-end-only at this stage:
 * the tree is driven by mock data so the interaction can be reviewed before the
 * backend grows a real folder entity. Once folders are persisted the adapter
 * that builds `KnowledgeNode[]` from server data is the only piece that needs
 * to change — every component below consumes this type directly.
 */
export type KnowledgeNodeType = 'space' | 'folder' | 'document'

export type KnowledgeNode = {
  id: string
  name: string
  type: KnowledgeNodeType
  children?: KnowledgeNode[]
}

/** Every action a node menu can emit. Handlers are wired up in a later stage. */
export type KnowledgeNodeAction =
  | 'edit'
  | 'rename'
  | 'move'
  | 'copy'
  | 'delete'

/** Shape returned by the sidebar's root-level "create" menu. */
export type KnowledgeCreateAction = 'new-document' | 'new-folder'

export function isContainer(node: KnowledgeNode): boolean {
  return node.type === 'space' || node.type === 'folder'
}
