import { ZodError } from 'zod'
import { isServerError } from '~/lib/errors'
import { contextFromHeaders, requireUserContext } from '~/server/services/context'

export async function requireApiContext(request: Request) {
  return requireUserContext(await contextFromHeaders(request.headers))
}

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

export async function parseJson(request: Request): Promise<unknown> {
  if (!request.body) return {}
  return request.json()
}

export function handleApiError(error: unknown) {
  if (isServerError(error)) {
    return json(
      { ok: false, code: error.code, error: error.message, details: error.details },
      { status: error.statusCode },
    )
  }
  if (error instanceof ZodError) {
    return json(
      { ok: false, code: 'VALIDATION_ERROR', error: '请求参数不合法', details: error.issues },
      { status: 400 },
    )
  }
  const message = error instanceof Error ? error.message : '服务暂时不可用'
  return json({ ok: false, code: 'INTERNAL', error: message }, { status: 500 })
}
