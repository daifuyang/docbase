import { z } from 'zod'

const expirationSeconds = {
  '30d': 30 * 24 * 60 * 60,
  '90d': 90 * 24 * 60 * 60,
  '1y': 365 * 24 * 60 * 60,
  never: undefined,
} as const

export const apiKeyExpirationSchema = z.enum(['30d', '90d', '1y', 'never'])

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, '请输入令牌名称').max(80, '令牌名称过长'),
  expiration: apiKeyExpirationSchema.default('90d'),
})

export const revokeApiKeySchema = z.object({
  keyId: z.string().min(1, '缺少令牌 ID'),
})

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>

export function expirationToSeconds(expiration: CreateApiKeyInput['expiration']) {
  return expirationSeconds[expiration]
}
