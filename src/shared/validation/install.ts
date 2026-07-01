import { z } from 'zod'
import { emailSchema, passwordSchema, usernameSchema } from './user'

export const installConfigSchema = z.object({
  databaseUrl: z.string().min(1, '请输入 PostgreSQL 连接地址'),
  redisUrl: z.string().min(1, '请输入 Redis 连接地址'),
  appUrl: z.string().url('请输入有效的站点地址'),
})

export const installAdminSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    displayName: z.string().min(1, '请输入显示名称').max(50, '显示名称过长'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, '请再次输入密码'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

export const installInputSchema = installConfigSchema.extend({
  admin: installAdminSchema,
})

export type InstallConfigInput = z.infer<typeof installConfigSchema>
export type InstallInput = z.infer<typeof installInputSchema>
