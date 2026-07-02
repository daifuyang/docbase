import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState, useTransition } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { getInstallState, runInstall, testInstallConfig } from '~/server/install'

export const Route = createFileRoute('/install')({
  beforeLoad: async () => {
    const state = await getInstallState()
    if (state.status === 'ready') throw redirect({ to: '/' })
    return { state }
  },
  component: InstallPage,
  head: () => ({ meta: [{ title: '安装 DocBase' }] }),
})

type Step = 'config' | 'check' | 'admin' | 'run'
type CheckState = Awaited<ReturnType<typeof testInstallConfig>> | null

const steps: Array<{ key: Step; title: string }> = [
  { key: 'config', title: '配置' },
  { key: 'check', title: '检测' },
  { key: 'admin', title: '管理员' },
  { key: 'run', title: '完成' },
]

function InstallPage() {
  const { state } = Route.useRouteContext()
  const navigate = useNavigate()
  const testConfigFn = useServerFn(testInstallConfig)
  const runInstallFn = useServerFn(runInstall)
  const [step, setStep] = useState<Step>('config')
  const [error, setError] = useState('')
  const [checks, setChecks] = useState<CheckState>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    databaseUrl: '',
    redisUrl: 'redis://localhost:6379',
    appUrl: typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin,
    email: '',
    username: 'admin',
    displayName: '管理员',
    password: '',
    confirmPassword: '',
  })

  if (state.status === 'config-error' || state.status === 'broken') {
    return (
      <InstallStatusPage
        title={state.status === 'broken' ? '安装状态异常' : '系统配置异常'}
        message={state.message}
      />
    )
  }

  const config = {
    databaseUrl: form.databaseUrl,
    redisUrl: form.redisUrl,
    appUrl: form.appUrl,
  }
  const currentStepIndex = steps.findIndex((item) => item.key === step)
  const canContinueFromChecks = Boolean(
    checks?.database.ok && checks.redis.ok && checks.configDir.ok,
  )

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function runChecks(nextStep: Step = 'check') {
    setError('')
    startTransition(async () => {
      try {
        const result = await testConfigFn({ data: config })
        setChecks(result)
        setStep(nextStep)
      } catch (err) {
        setError(getErrorMessage(err))
      }
    })
  }

  function submitInstall() {
    setError('')
    setStep('run')
    startTransition(async () => {
      try {
        await runInstallFn({
          data: {
            ...config,
            admin: {
              email: form.email,
              username: form.username,
              displayName: form.displayName,
              password: form.password,
              confirmPassword: form.confirmPassword,
            },
          },
        })
        await navigate({ to: '/' })
      } catch (err) {
        setError(getErrorMessage(err))
      }
    })
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f7f9fc_44%,#ffffff_100%)] px-4 py-8 text-[#1f1f1f] sm:px-6 lg:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex items-center gap-3 px-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1677ff] text-base font-bold text-white shadow-[0_10px_24px_rgba(22,119,255,0.24)]">
            D
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight text-[#10239e]">DocBase</div>
            <div className="text-xs text-[#737373]">企业知识库安装向导</div>
          </div>
        </header>

        <main className="w-full overflow-hidden rounded-2xl border border-[#e6eaf2] bg-white shadow-[0_24px_80px_rgba(31,56,88,0.14)]">
          <div className="border-b border-[#edf0f5] bg-[#fbfcff] px-6 py-5 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-4xl">
              <StepBar currentStepIndex={currentStepIndex} />
            </div>
          </div>

          <section className="px-6 py-8 sm:px-8 sm:py-10 lg:px-12">
            <div className="mx-auto max-w-4xl">
              {state.status === 'installing' && (
                <Notice>检测到安装任务正在执行，请稍后刷新页面查看结果。</Notice>
              )}
              {state.hasConfig && !state.hasLock && (
                <Notice>检测到已有配置，但安装尚未完成。你可以继续完成安装。</Notice>
              )}
              {error && <ErrorBox>{error}</ErrorBox>}

              <div className="mx-auto max-w-3xl">
                {step === 'config' && (
                  <Panel
                    title="连接配置"
                    description="填写数据库、缓存和站点地址。认证密钥会自动生成。"
                  >
                    <Field label="PostgreSQL 连接地址">
                      <Input
                        value={form.databaseUrl}
                        onChange={(event) => update('databaseUrl', event.target.value)}
                        placeholder="postgres://user:password@localhost:5432/docbase"
                        className="h-11 bg-white"
                      />
                    </Field>
                    <Field label="Redis 连接地址">
                      <Input
                        value={form.redisUrl}
                        onChange={(event) => update('redisUrl', event.target.value)}
                        placeholder="redis://localhost:6379"
                        className="h-11 bg-white"
                      />
                    </Field>
                    <Field label="站点地址">
                      <Input
                        value={form.appUrl}
                        onChange={(event) => update('appUrl', event.target.value)}
                        placeholder="https://docbase.example.com"
                        className="h-11 bg-white"
                      />
                    </Field>
                    <Actions>
                      <Button
                        type="button"
                        size="lg"
                        disabled={pending}
                        onClick={() => runChecks()}
                      >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        测试连接
                      </Button>
                    </Actions>
                  </Panel>
                )}

                {step === 'check' && (
                  <Panel title="连接检测" description="检测通过后即可继续创建管理员账号。">
                    {checks?.hasUsers && (
                      <WarningBox>
                        检测到数据库已有用户。继续安装会覆盖管理员账号信息，但不会清空已有文档、空间和标签数据。
                      </WarningBox>
                    )}
                    <CheckRow label="PostgreSQL" result={checks?.database} />
                    <CheckRow label="Redis" result={checks?.redis} />
                    <CheckRow label="配置目录" result={checks?.configDir} />
                    <Actions>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={pending}
                        onClick={() => runChecks()}
                      >
                        重新检测
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        disabled={!canContinueFromChecks}
                        onClick={() => setStep('admin')}
                      >
                        继续
                      </Button>
                    </Actions>
                  </Panel>
                )}

                {step === 'admin' && (
                  <Panel
                    title="管理员账号"
                    description="如果邮箱或用户名已存在，将重置该账号并赋予管理员权限。"
                  >
                    {checks?.hasUsers && (
                      <WarningBox>覆盖安装不会清空业务数据，只会更新管理员账号和密码。</WarningBox>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="邮箱">
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(event) => update('email', event.target.value)}
                          className="h-11 bg-white"
                        />
                      </Field>
                      <Field label="用户名">
                        <Input
                          value={form.username}
                          onChange={(event) => update('username', event.target.value)}
                          className="h-11 bg-white"
                        />
                      </Field>
                    </div>
                    <Field label="显示名称">
                      <Input
                        value={form.displayName}
                        onChange={(event) => update('displayName', event.target.value)}
                        className="h-11 bg-white"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="密码">
                        <Input
                          type="password"
                          value={form.password}
                          onChange={(event) => update('password', event.target.value)}
                          className="h-11 bg-white"
                        />
                      </Field>
                      <Field label="确认密码">
                        <Input
                          type="password"
                          value={form.confirmPassword}
                          onChange={(event) => update('confirmPassword', event.target.value)}
                          className="h-11 bg-white"
                        />
                      </Field>
                    </div>
                    <Actions>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setStep('check')}
                      >
                        返回
                      </Button>
                      <Button type="button" size="lg" disabled={pending} onClick={submitInstall}>
                        开始安装
                      </Button>
                    </Actions>
                  </Panel>
                )}

                {step === 'run' && (
                  <Panel title="初始化系统" description="正在执行迁移、写入配置并处理管理员账号。">
                    <RunRow active={pending} done={!pending && !error} label="写入配置文件" />
                    <RunRow active={pending} done={!pending && !error} label="执行数据库迁移" />
                    <RunRow active={pending} done={!pending && !error} label="覆盖或创建管理员" />
                    <RunRow active={pending} done={!pending && !error} label="写入安装锁" />
                    {!pending && error && (
                      <Actions>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => setStep('admin')}
                        >
                          返回修改
                        </Button>
                      </Actions>
                    )}
                  </Panel>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function StepBar({ currentStepIndex }: { currentStepIndex: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2">
      {steps.map((item, index) => {
        const done = index < currentStepIndex
        const active = index === currentStepIndex
        return (
          <li key={item.key} className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-[#1677ff] text-white' : active ? 'border border-[#91caff] bg-[#e6f4ff] text-[#0958d9]' : 'bg-[#f0f2f5] text-[#8c8c8c]'}`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={`truncate text-sm ${active ? 'font-semibold text-[#1f1f1f]' : 'text-[#737373]'}`}
              >
                {item.title}
              </span>
            </div>
            <div
              className={`mt-3 h-1 rounded-full ${done || active ? 'bg-[#1677ff]' : 'bg-[#e6eaf2]'}`}
            />
          </li>
        )
      })}
    </ol>
  )
}

function Panel({
  title,
  description,
  children,
}: { title: string; description: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#1f1f1f]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[#737373]">{description}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block space-y-2">
      <span className="text-sm font-medium text-[#262626]">{label}</span>
      {children}
    </div>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-[#edf0f5] pt-5 sm:flex-row sm:justify-end">
      {children}
    </div>
  )
}

function CheckRow({ label, result }: { label: string; result?: { ok: boolean; message: string } }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#edf0f5] bg-[#fbfcff] px-4 py-3">
      {result?.ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
      )}
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div
          className={
            result?.ok ? 'mt-1 text-xs text-muted-foreground' : 'mt-1 text-xs text-destructive'
          }
        >
          {result?.message ?? '尚未检测'}
        </div>
      </div>
    </div>
  )
}

function RunRow({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#edf0f5] bg-[#fbfcff] px-4 py-3 text-sm">
      {active ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : done ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      {label}
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-[#91caff] bg-[#e6f4ff] px-4 py-3 text-sm text-[#0958d9]">
      {children}
    </div>
  )
}

function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#ffd591] bg-[#fff7e6] px-4 py-3 text-sm leading-6 text-[#874d00]">
      {children}
    </div>
  )
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {children}
    </div>
  )
}

function InstallStatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5">
      <div className="w-full max-w-lg rounded-2xl border border-white/90 bg-white/96 p-8 text-center shadow-[0_24px_72px_rgba(31,56,88,0.16)]">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1f1f1f]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#737373]">{message}</p>
      </div>
    </div>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return '操作失败，请检查配置后重试。'
}
