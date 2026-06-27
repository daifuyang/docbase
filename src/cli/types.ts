/**
 * Shared types for the DocBase CLI.
 */

export type Credentials = {
  /** Plaintext API key (the only time it is exposed after creation). */
  apiKey: string
  /** Stable id of the key — used for revocation. */
  apiKeyId: string
  /** Optional prefix echoed back from the plugin (e.g. "docbase"). */
  prefix: string | null
  /** Owner of the key. */
  user: {
    id: string
    username: string
    displayName: string | null
    role: 'admin' | 'member'
  }
  createdAt: string
}

/**
 * Optional frontmatter fields. `space` and `category` accept either a slug
 * OR a display name (the CLI resolves names by querying the listSpaces /
 * listCategories endpoints).
 */
export type Frontmatter = {
  title: string
  status?: 'draft' | 'published'
  tags?: string[]
  space?: string
  category?: string
}

export type OutputOpts = {
  json: boolean
  color: boolean
  verbose: boolean
}