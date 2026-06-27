/**
 * Thin HTTP client for the DocBase server's CLI API.
 *
 * When `--server <url>` (or `DOCABASE_SERVER`) is set, every operation
 * round-trips to `/api/v1/cli/*` endpoints on that server. The CLI binary
 * distributed via GitHub Releases is built with `bun build --compile` and
 * is HTTP-only — it intentionally does NOT import the in-process service
 * layer (which depends on better-auth + TanStack Start virtual modules)
 * so the binary stays self-contained and small.
 *
 * For local dev / in-process mode, run the source via `pnpm cli` (tsx).
 *
 * Auth failures (no credentials / invalid key / expired key / server 401)
 * bubble up as ServerError so `errors.ts` can map them to exit code 4.
 */
import { Errors, ServerError } from '~/lib/errors'
import { loadCredentials } from './credentials'

/** Surface an API key that is past its expiry as a friendlier 401 message. */
function checkExpiry(expiresAt: string | null): void {
  if (!expiresAt) return
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return
  const remainingMs = t - Date.now()
  if (remainingMs <= 0) {
    throw Errors.unauthenticated(
      `API key 已于 ${expiresAt} 过期，请重新运行 \`docbase auth login\``,
    )
  }
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  if (remainingMs < SEVEN_DAYS) {
    const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
    process.stderr.write(
      `warn: API key 将在 ${days} 天后过期（${expiresAt}），请提前 \`docbase auth login\` 续期\n`,
    )
  }
}

/**
 * Build an ApiClient from program-level opts. Throws if `--server` /
 * DOCABASE_SERVER is missing — every CLI command now needs a remote
 * server (HTTP-only mode).
 */
export function makeApiClient(program: { opts: () => { server?: string } }): ApiClient {
  const raw = program.opts().server ?? process.env.DOCBASE_SERVER
  if (!raw) {
    throw Errors.internal(
      'CLI 当前为 HTTP-only 模式：需要 --server <url> 或 DOCABASE_SERVER=<url>',
    )
  }
  return new ApiClient(raw.replace(/\/+$/, ''))
}

export class ApiClient {
  constructor(private readonly serverUrl: string) {}

  whoami = async () => this.http('GET', '/api/v1/cli/auth/whoami')

  /**
   * Sign in via HTTP. Does NOT require existing credentials (we're
   * creating them). Bypasses `http()`'s credential check by calling
   * fetch directly.
   */
  signIn = async (account: string, password: string) => {
    const url = new URL('/api/v1/cli/auth/login', this.serverUrl)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password }),
    })
    if (!res.ok) throw await mapHttpError(res)
    return (await res.json()) as {
      user: {
        id: string
        username: string
        displayName: string | null
        bio: string | null
        role: 'admin' | 'member'
        createdAt: string
      }
      session: { token: string; expiresAt: string }
    }
  }

  /**
   * Server-side session revocation. Best-effort — used during logout.
   * Skips the expiry check so an expired token can still be sent.
   */
  logout = async () => {
    const creds = loadCredentials()
    const url = new URL('/api/v1/cli/auth/logout', this.serverUrl)
    const headers: Record<string, string> = {}
    if (creds) headers.Authorization = `Bearer ${creds.sessionToken}`
    const res = await fetch(url, { method: 'POST', headers })
    if (!res.ok && res.status !== 401) {
      throw await mapHttpError(res)
    }
  }

  listSpaces = async () =>
    this.http<{
      items: Array<{ id: string; name: string; slug: string; description: string | null }>
    }>('GET', '/api/v1/cli/spaces')

  createSpace = async (input: { name: string; description?: string }) =>
    this.http<{ space: { id: string; name: string; slug: string } }>(
      'POST',
      '/api/v1/cli/spaces',
      input,
    )

  listCategories = async (spaceId: string) =>
    this.http<{
      items: Array<{
        id: string
        spaceId: string
        name: string
        slug: string
        description: string | null
      }>
    }>('GET', `/api/v1/cli/spaces/${spaceId}/categories`)

  createCategory = async (input: {
    spaceId: string
    name: string
    description?: string
  }) => {
    const { spaceId, ...body } = input
    return this.http<{ category: { id: string; name: string; slug: string } }>(
      'POST',
      `/api/v1/cli/spaces/${spaceId}/categories`,
      body,
    )
  }

  listTags = async (limit?: number) => {
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : ''
    return this.http<{ items: Array<{ id: string; name: string; slug: string }> }>(
      'GET',
      `/api/v1/cli/tags${qs}`,
    )
  }

  createTag = async (input: { name: string }) =>
    this.http<{ tag: { id: string; name: string; slug: string } }>(
      'POST',
      '/api/v1/cli/tags',
      input,
    )

  listDocuments = async (input: Record<string, unknown>) => {
    const qs = new URLSearchParams(
      Object.entries(input).filter(([, v]) => v != null) as [string, string][],
    ).toString()
    return this.http<{
      items: Array<{
        id: string
        title: string
        slug: string
        excerpt: string | null
        status: 'draft' | 'published'
        spaceId: string | null
        categoryId: string | null
        updatedAt: string
      }>
      total: number
      page: number
      pageSize: number
    }>('GET', `/api/v1/cli/documents${qs ? `?${qs}` : ''}`)
  }

  getDocument = async (slug: string) =>
    this.http<{
      id: string
      title: string
      slug: string
      excerpt: string | null
      status: string
      contentJson: unknown
      contentHtml: string
      space: unknown
      category: unknown
      tags: string[]
      creator: unknown
      updatedAt: string
      publishedAt: string | null
      viewCount: number
    }>('GET', `/api/v1/cli/documents/${encodeURIComponent(slug)}`)

  createDocument = async (input: {
    title: string
    contentMarkdown: string
    spaceId: string
    categoryId?: string
    status?: 'draft' | 'published'
    tags?: string[]
  }) =>
    this.http<{ document: { id: string; title: string; slug: string; status: string } }>(
      'POST',
      '/api/v1/cli/documents',
      input,
    )

  updateDocument = async (
    slug: string,
    input: {
      title?: string
      contentMarkdown?: string
      status?: 'draft' | 'published'
      tags?: string[]
    },
  ) =>
    this.http<{ document: unknown }>(
      'PUT',
      `/api/v1/cli/documents/${encodeURIComponent(slug)}`,
      input,
    )

  deleteDocument = async (slug: string) =>
    this.http<{ ok: true }>('DELETE', `/api/v1/cli/documents/${encodeURIComponent(slug)}`)

  // ----------------------------------------------------------------
  // HTTP plumbing
  // ----------------------------------------------------------------
  private async http<T>(method: string, path: string, body?: unknown): Promise<T> {
    const creds = loadCredentials()
    if (!creds) {
      throw Errors.unauthenticated('未登录，请先运行 `docbase auth login`')
    }
    checkExpiry(creds.sessionExpiresAt)

    const url = new URL(path, this.serverUrl)
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${creds.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      throw Errors.internal(`无法连接 ${url.origin}：${(err as Error).message}`)
    }

    if (!res.ok) {
      throw await mapHttpError(res)
    }
    if (res.status === 204) return {} as T
    return (await res.json()) as T
  }
}

/** Translate HTTP error response into the project's ServerError shape. */
async function mapHttpError(res: Response): Promise<ServerError> {
  let body: { code?: string; message?: string; statusCode?: number } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    // non-JSON body
  }
  const code = body.code ?? mapStatusToCode(res.status)
  const message = body.message ?? res.statusText ?? `HTTP ${res.status}`
  const statusCode = body.statusCode ?? res.status
  return new ServerError({ code, message, statusCode })
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR'
    case 401:
      return 'UNAUTHENTICATED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 429:
      return 'RATE_LIMITED'
    default:
      return status >= 500 ? 'INTERNAL' : 'ERROR'
  }
}
