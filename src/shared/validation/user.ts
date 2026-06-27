import { z } from 'zod'

export const emailSchema = z
  .string()
  .min(1, '请输入邮箱')
  .max(254, '邮箱过长')
  .email('邮箱格式不正确')
  .transform((s) => s.toLowerCase().trim())

export const usernameSchema = z
  .string()
  .min(3, '用户名至少 3 个字符')
  .max(30, '用户名最多 30 个字符')
  .regex(/^[a-zA-Z0-9_-]+$/, '仅支持字母、数字、下划线、连字符')
  .transform((s) => s.toLowerCase().trim())

export const accountSchema = z
  .string()
  .min(1, '请输入账号')
  .max(254, '账号过长')
  .transform((s) => s.toLowerCase().trim())

export const passwordSchema = z.string().min(8, '密码至少 8 位字符').max(128, '密码过长')

export const displayNameSchema = z.string().min(1).max(50).optional()

export const bioSchema = z.string().max(500).optional()

export const signUpSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
})
export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  account: accountSchema,
  password: z.string().min(1, '请输入密码'),
})
export type SignInInput = z.infer<typeof signInSchema>
