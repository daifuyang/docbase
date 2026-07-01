import { Errors } from '~/lib/errors'
import { createApiKeyService, getCurrentUserService, signInService } from '~/server/services/auth'
/**
 * Thin wrapper around the service layer.
 *
 * - In-process (default): builds a `ServiceContext` from the saved API key
 *   and calls `src/server/services/*` directly.
 * - HTTP (DOCBASE_HTTP=1, reserved for v2): would round-trip to the running
 *   web server. Not implemented yet.
 *
 * Auth failures (no credentials file or invalid key) bubble up as
 * ServerError(401) so the CLI's `errors.ts` can map them to exit code 4.
 */
import {
  type ServiceContext,
  contextFromHeaders,
  requireUserContext,
} from '~/server/services/context'
import {
  createDocumentService,
  deleteDocumentService,
  getDocumentBySlugService,
  listDocumentsService,
  updateDocumentService,
} from '~/server/services/documents'
import { listSpacesService } from '~/server/services/spaces'
import { listTagsService } from '~/server/services/tags'
import { loadCredentials } from './credentials'

export class ApiClient {
  private ctxPromise: Promise<ServiceContext> | null = null

  async context(): Promise<ServiceContext> {
    if (this.ctxPromise) return this.ctxPromise
    this.ctxPromise = (async () => {
      const creds = loadCredentials()
      if (!creds) {
        throw Errors.unauthenticated('未登录，请先运行 `docbase auth login`')
      }
      const headers = new Headers()
      headers.set('x-api-key', creds.apiKey)
      return requireUserContext(await contextFromHeaders(headers))
    })()
    return this.ctxPromise
  }

  async signIn(account: string, password: string) {
    return signInService({ account, password })
  }

  async createApiKey(opts: { userId: string; name?: string }) {
    return createApiKeyService({ userId: opts.userId, name: opts.name })
  }

  whoami = () => this.context().then((c) => getCurrentUserService(c))

  listSpaces = () => this.context().then((c) => listSpacesService(c))

  listCategories = async () => {
    const { listCategoriesService } = await import('~/server/services/spaces')
    return this.context().then((c) => listCategoriesService(c))
  }

  listTags = (limit?: number) => this.context().then((c) => listTagsService(c, { limit }))

  listDocuments = (input: unknown) => this.context().then((c) => listDocumentsService(c, input))

  getDocument = (slug: string) => this.context().then((c) => getDocumentBySlugService(c, { slug }))

  createDocument = (input: Parameters<typeof createDocumentService>[1]) =>
    this.context().then((c) => createDocumentService(c, input))

  updateDocument = (input: Parameters<typeof updateDocumentService>[1]) =>
    this.context().then((c) => updateDocumentService(c, input))

  deleteDocument = (id: string) => this.context().then((c) => deleteDocumentService(c, { id }))

  findDocumentIdBySlug = (slug: string) =>
    this.context().then((c) =>
      import('~/server/services/documents').then((m) => m.findDocumentIdBySlugService(c, { slug })),
    )
}
