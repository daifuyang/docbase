import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '~/components/login-form'
import { getCurrentUser } from '~/server/auth'
import { getInstallState } from '~/server/install'

export const Route = createFileRoute('/auth/login')({
  beforeLoad: async () => {
    const installState = await getInstallState()
    if (installState.status !== 'ready') throw redirect({ to: '/install' })
    const me = await getCurrentUser()
    if (me) throw redirect({ to: '/' })
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: '登录 — DocBase' }] }),
})

function LoginPage() {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f5f7fb] bg-cover bg-no-repeat"
      style={{
        backgroundImage: "url('/images/login-knowledge-hero.png')",
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(245,247,251,0.7)_0%,rgba(245,247,251,0.9)_48%,rgba(245,247,251,0.98)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0)_100%)]" />

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#10239e]">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1677ff] text-sm font-bold text-white shadow-[0_8px_20px_rgba(22,119,255,0.28)]">
            D
          </span>
          DocBase
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[430px] rounded-lg border border-white/90 bg-white/96 px-9 py-10 shadow-[0_24px_72px_rgba(31,56,88,0.16)] backdrop-blur md:px-11 md:py-12">
            <div className="mb-9 text-center">
              <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-[#1f1f1f]">
                欢迎登录
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#737373]">登录 DocBase 企业知识库</p>
            </div>
            <LoginForm />
          </div>
        </main>
      </div>
    </div>
  )
}
