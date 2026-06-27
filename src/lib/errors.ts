/**
 * Unified server error type for DocBase.
 * Server functions throw createServerError(...); client branches on `code`.
 */
export class ServerError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: unknown

  constructor(opts: { code: string; message: string; statusCode: number; details?: unknown }) {
    super(opts.message)
    this.name = 'ServerError'
    this.code = opts.code
    this.statusCode = opts.statusCode
    this.details = opts.details
  }
}

export function createServerError(
  code: string,
  statusCode: number,
  message: string,
  details?: unknown,
): ServerError {
  return new ServerError({ code, statusCode, message, details })
}

export const Errors = {
  validation: (msg = '请求参数不合法', details?: unknown) =>
    createServerError('VALIDATION_ERROR', 400, msg, details),
  unauthenticated: (msg = '请先登录') => createServerError('UNAUTHENTICATED', 401, msg),
  forbidden: (msg = '权限不足') => createServerError('FORBIDDEN', 403, msg),
  notFound: (msg = '资源不存在') => createServerError('NOT_FOUND', 404, msg),
  emailTaken: () => createServerError('EMAIL_TAKEN', 409, '该邮箱已被注册'),
  usernameTaken: () => createServerError('USERNAME_TAKEN', 409, '该用户名已被占用'),
  invalidCredentials: () => createServerError('INVALID_CREDENTIALS', 401, '账号或密码错误'),
  weakPassword: () => createServerError('WEAK_PASSWORD', 400, '密码至少需要 8 位字符'),
  invalidEmail: () => createServerError('INVALID_EMAIL', 400, '邮箱格式不正确'),
  rateLimited: (resetAt: number) =>
    createServerError('RATE_LIMITED', 429, '操作过于频繁，请稍后再试', { resetAt }),
  internal: (msg = '服务暂时不可用，请稍后再试') => createServerError('INTERNAL', 500, msg),
}

export function isServerError(e: unknown): e is ServerError {
  return e instanceof ServerError
}
