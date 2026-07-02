'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Eye, EyeOff } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { signIn } from '~/server/auth'
import { type SignInInput, signInSchema } from '~/shared/validation/user'

function getErrorField(error: unknown, field: 'code' | 'message') {
  if (typeof error !== 'object' || error === null) return undefined
  const record = error as Record<string, unknown>
  const value = record[field]
  if (typeof value === 'string') return value
  const data = record.data
  if (typeof data !== 'object' || data === null) return undefined
  const nestedValue = (data as Record<string, unknown>)[field]
  return typeof nestedValue === 'string' ? nestedValue : undefined
}

function normalizeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const safeRedirectTo = normalizeRedirect(redirectTo)
  const signInFn = useServerFn(signIn)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { account: '', password: '' },
  })

  const onSubmit = (values: SignInInput) => {
    setServerError(null)
    startTransition(async () => {
      try {
        await signInFn({ data: values })
        await router.invalidate()
        router.history.push(safeRedirectTo)
      } catch (err: unknown) {
        const code = getErrorField(err, 'code')
        if (code === 'INVALID_CREDENTIALS') setServerError('账号或密码错误')
        else if (code === 'RATE_LIMITED') setServerError('操作过于频繁，请稍后再试')
        else setServerError(getErrorField(err, 'message') ?? '登录失败')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <input
          id="account"
          type="text"
          autoComplete="username"
          placeholder="请输入账号"
          {...register('account')}
          aria-label="账号"
          className="block h-11 w-full rounded-md border border-[#d9d9d9] bg-white px-3.5 text-sm text-[#1f1f1f] caret-[#1677ff] transition-colors placeholder:text-[#8c8c8c] hover:border-[#4096ff] focus:border-[#1677ff] focus:outline-none"
        />
        {errors.account && <p className="text-xs text-destructive">{errors.account.message}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="请输入密码"
            {...register('password')}
            aria-label="密码"
            className="block h-11 w-full rounded-md border border-[#d9d9d9] bg-white px-3.5 pr-11 text-sm text-[#1f1f1f] caret-[#1677ff] transition-colors placeholder:text-[#8c8c8c] hover:border-[#4096ff] focus:border-[#1677ff] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#8c8c8c] transition-colors hover:bg-[#f5f5f5] hover:text-[#262626] focus:outline-none"
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-11 w-full rounded-md bg-[#1677ff] px-4 text-sm font-medium text-white shadow-[0_8px_18px_rgba(22,119,255,0.24)] transition-colors hover:bg-[#4096ff] disabled:opacity-50"
      >
        {pending ? '登录中…' : '登录'}
      </button>
    </form>
  )
}
