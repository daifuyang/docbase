/**
 * Thin wrapper around the service layer.
 *
 * Two modes:
 * - In-process (default): builds a `ServiceContext` from the saved API key
 *   and calls `src/server/services/*` directly. Requires full source +
 *   node_modules + a working .env on the same machine as the database.
 * - HTTP (when `serverUrl` is set): round-trips to the running DocBase
 *   server via `/api/v1/cli/*` endpoints. Only needs network access to the
 *   server + a valid API Key on this machine. See `docs/cli.md` for setup.
 *
 * Auth failures (no credentials / invalid key / expired key / server 401)
 * bubble up as ServerError so `errors.ts` can map them to exit code 4.
 */
import { contextFromHeaders, type ServiceContext } from '~/server/services/context'
import {
  createApiKeyService,
  getCurrentUserService,
  signInService,
} from '~/server/services/auth'
import {
  createCategoryService,
  createSpaceService,
  listSpacesService,
} from '~/server/services/spaces'
import { createTagService, listTagsService } from '~/server/services/tags'
import {
  createDocumentService,
  deleteDocumentService,
  getDocumentBySlugService,
  listDocumentsService,
  updateDocumentService,
} from '~/server/services/documents'
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

export class ApiClient {
  private ctxPromise: Promise<ServiceContext> | null = null

  constructor(serverUrl?: string) {
    // Allow callers to pass nothing — we'll pick up `DOCBASE_SERVER` from
    // the env (set by `--server` flag via program.hook('preAction')).
    if (!serverUrl) {
      const envUrl = process.env.DOCBASE_SERVER
      if (envUrl) serverUrl = envUrl.replace(/\/+$/, '')
    }
    this.serverUrl = serverUrl
  }

  private readonly serverUrl?: string

  /** True when constructed with a `--server` URL — every call goes over HTTP. */
  private get isHttp(): boolean {
    return Boolean(this.serverUrl)
  }

  // ----------------------------------------------------------------
  // In-process path (only used when no `--server` is configured)
  // ----------------------------------------------------------------
  async context(): Promise<ServiceContext> {
    if (this.isHttp) {
      throw Errors.internal(
        'context() called in HTTP mode; use whoami()/listSpaces() etc. directly',
      )
    }
    if (this.ctxPromise) return this.ctxPromise
    this.ctxPromise = (async () => {
      const creds = loadCredentials()
      if (!creds) {
        throw Errors.unauthenticated('未登录，请先运行 `docbase auth login`')
      }
      checkExpiry(creds.expiresAt)
      const headers = new Headers()
      headers.set('x-api-key', creds.apiKey)
      return contextFromHeaders(headers)
    })()
    return this.ctxPromise
  }

  // ----------------------------------------------------------------
  // Auth (login itself is in-process — it must reach the DB to issue a key)
  // ----------------------------------------------------------------
  async signIn(account: string, password: string) {
    if (this.isHttp) {
      return this.http<Awaited<ReturnType<typeof signInService>>>(
        'POST',
        '/api/v1/cli/auth/login',
        { account, password },
      )
    }
    return signInService({ account, password })
  }

  async createApiKey(opts: { userId: string; name?: string }) {
    return createApiKeyService({ userId: opts.userId, name: opts.name })
  }

  whoami = async () => {
    if (this.isHttp) {
      return this.http<Awaited<ReturnType<typeof getCurrentUserService>>>(
        'GET',
        '/api/v1/cli/auth/whoami',
      )
    }
    return this.context().then((c) => getCurrentUserService(c))
  }

  // ----------------------------------------------------------------
  // Spaces / Categories / Tags
  // ----------------------------------------------------------------
  listSpaces = async () => {
    if (this.isHttp) {
      return this.http<Awaited<ReturnType<typeof listSpacesService>>>(
        'GET',
        '/api/v1/cli/spaces',
      )
    }
    return this.context().then((c) => listSpacesService(c))
  }

  createSpace = async (input: { name: string; description?: string }) => {
    if (this.isHttp) {
      return this.http<Awaited<ReturnType<typeof createSpaceService>>>(
        'POST',
        '/api/v1/cli/spaces',
        input,
      )
    }
    return this.context().then((c) => createSpaceService(c, input))
  }

  createCategory = async (input: { spaceId: string; name: string; description?: string }) => {
    if (this.isHttp) {
      const { spaceId, ...body } = input
      return this.http<Awaited<ReturnType<typeof createCategoryService>>>(
        'POST',
        `/api/v1/cli/spaces/${spaceId}/categories`,
        body,
      )
    }
    return this.context().then((c) => createCategoryService(c, input))
  }

  listCategories = async () => {
    if (this.isHttp) {
      // Server doesn't yet have a flat listCategories endpoint — only per-space.
      // For HTTP mode callers, prefer iterating per-space or going through
      // listSpaces then listCategoriesBySpace per space.
      throw Errors.internal(
        'listCategories() not yet supported in HTTP mode — query per-space instead',
      )
    }
    const { listCategoriesService } = await import('~/server/services/spaces')
    return this.context().then((c) => listCategoriesService(c))
  }

  listTags = async (limit?: number) => {
    if (this.isHttp) {
      const qs = limit ? `?limit=${encodeURIComponent(limit)}` : ''
      return this.http<Awaited<ReturnType<typeof listTagsService>>>(
        'GET',
        `/api/v1/cli/tags${qs}`,
      )
    }
    return this.context().then((c) => listTagsService(c, { limit }))
  }

  createTag = async (input: { name: string }) => {
    if (this.isHttp) {
      return this.http<Awaited<ReturnType<typeof createTagService>>>(
        'POST',
        '/api/v1/cli/tags',
        input,
      )
    }
    return this.context().then((c) => createTagService(c, input))
  }

  // ----------------------------------------------------------------
  // Documents
  // ----------------------------------------------------------------
  listDocuments = async (input: Record<string, unknown>) => {
    if (this.isHttp) {
      const qs = new URLSearchParams(
        Object.entries(input).filter(([, v]) => v != null) as [string, string][],
      ).toString()
      return this.http<Awaited<ReturnType<typeof listDocumentsService>>>(
        'GET',
        `/api/v1/cli/documents${qs ? `?${qs}` : ''}`,
      )
    }
    // biome-ignore lint/suspicious/noExplicitAny: forwarded to existing typed service
    return this.context().then((c) => listDocumentsService(c, input as any))
  }

  getDocument = async (slug: string) => {
    if (this.isHttp) {
      return this.http<Awaited<ReturnType<typeof getDocumentBySlugService>>>(
        'GET',
        `/api/v1/cli/documents/${encodeURIComponent(slug)}`,
      )
    }
    return this.context().then((c) => getDocumentBySlugService(c, { slug }))
  }

  createDocument = async (
    input: Parameters<typeof createDocumentService>[1],
  ) => {
    if (this.isHttp) {
      const { contentJson, ...body } = input as typeof input & { contentJson: unknown }
      return this.http<Awaited<ReturnType<typeof createDocumentService>>>(
        'POST',
        '/api/v1/cli/documents',
        {
          ...body,
          contentMarkdown: input.contentJson ? '' : '',
          _contentJson: contentJson,
        },
      )
    }
    return this.context().then((c) => createDocumentService(c, input))
  }

  updateDocument = async (
    input: Parameters<typeof updateDocumentService>[1],
  ) => {
    if (this.isHttp) {
      // HTTP update takes slug; in-process takes id. Caller's responsibility
      // to pass a slug if HTTP mode is on.
      throw Errors.internal(
        'HTTP mode update requires slug — not yet wired in CLI update commands',
      )
    }
    return this.context().then((c) => updateDocumentService(c, input))
  }

  deleteDocument = async (id: string) => {
    if (this.isHttp) {
      throw Errors.internal(
        'HTTP mode delete requires slug — not yet wired in CLI delete commands',
      )
    }
    return this.context().then((c) => deleteDocumentService(c, { id }))
  }

  // ----------------------------------------------------------------
  // HTTP plumbing
  // ----------------------------------------------------------------
  private async http<T>(method: string, path: string, body?: unknown): Promise<T> {
    const creds = loadCredentials()
    if (!creds) {
      throw Errors.unauthenticated('未登录，请先运行 `docbase auth login`')
    }
    checkExpiry(creds.expiresAt)

    const url = new URL(path, this.serverUrl)
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      throw Errors.internal(
        `无法连接 ${url.origin}：${(err as Error).message}`,
      )
    }

    if (!res.ok) {
      throw await mapHttpError(res)
    }
    // 204 No Content (e.g. logout) → resolve with empty object cast.
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
