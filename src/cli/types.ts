/**
 * Shared types for the DocBase CLI.
 *
 * The CLI binary (GitHub Releases) is HTTP-only — it calls the server's
 * `/api/v1/cli/*` endpoints using the session token issued by `auth login`
 * as a Bearer token. Web uses session cookies. Both paths converge on the
 * same ServiceContext layer on the server.
 */

export type Credentials = {
  /** Bearer token for the HTTP API (issued by signInService). */
  sessionToken: string
  /** Session expiry as ISO timestamp (7 days from issue by default). */
  sessionExpiresAt: string
  /** Cached identity of the signed-in user (saves a roundtrip on `whoami`). */
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