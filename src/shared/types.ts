import type { JSONContent } from '@tiptap/core'

// Public-facing DTOs shared between server and client

export type PublicUser = {
  id: string
  username: string
  displayName: string | null
  bio: string | null
  role?: 'admin' | 'member'
  createdAt: string
}

export type SpaceSummary = {
  id: string
  name: string
  slug: string
  description: string | null
}

export type CategorySummary = {
  id: string
  spaceId: string
  name: string
  slug: string
  description: string | null
}

export type DocumentTreeItem = {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  updatedAt: string
}

export type CategoryTreeItem = CategorySummary & {
  documents: DocumentTreeItem[]
}

export type SpaceTreeItem = SpaceSummary & {
  categories: CategoryTreeItem[]
  documents: DocumentTreeItem[]
}

export type DocumentSummary = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  creator: Pick<PublicUser, 'id' | 'username' | 'displayName'>
  author: Pick<PublicUser, 'id' | 'username' | 'displayName'>
  space: SpaceSummary | null
  category: CategorySummary | null
  publishedAt: string | null
  updatedAt: string
  viewCount: number
  tags: string[]
}

export type DocumentDetail = DocumentSummary & {
  contentHtml: string
  contentJson?: TipTapDoc
  status: 'draft' | 'published'
  isAuthor: boolean
}

export type Tag = {
  id: string
  name: string
  slug: string
}

export type TipTapDoc = JSONContent & {
  type: 'doc'
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}
