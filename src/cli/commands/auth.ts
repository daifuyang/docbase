/**
 * auth login / whoami / logout — HTTP-only (the CLI binary is HTTP-only;
 * source-side `pnpm cli` runs the same code, so no in-process branch
 * is needed here).
 */
import type { Command } from 'commander'
import { Errors } from '~/lib/errors'
import { clearCredentials, loadCredentials, saveCredentials } from '../credentials'
import { ApiClient } from '../api-client'
import { formatOutput, printInfo } from '../output'
import { promptHidden } from '../prompt'
import type { OutputOpts } from '../types'

function resolveServerUrl(opts: { server?: string }): string {
  const raw = opts.server ?? process.env.DOCBASE_SERVER
  if (!raw) {
    throw Errors.internal(
      'CLI 当前为 HTTP-only 模式：需要 --server <url> 或 DOCABASE_SERVER=<url>',
    )
  }
  return raw.replace(/\/+$/, '')
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('认证与会话管理')

  auth
    .command('login')
    .description('登录：调远端 server 拿 session token 存到本地')
    .option('--username <account>', '用户名或邮箱')
    .option('--password <pwd>', '密码（省略则交互输入）')
    .action(async (opts: { username?: string; password?: string }) => {
      const globalOpts = program.opts<OutputOpts & { server?: string }>()
      const serverUrl = resolveServerUrl(globalOpts)
      const username = opts.username
      if (!username) throw Errors.validation('请提供 --username <账号>')
      const password = opts.password ?? (await promptHidden('Password: '))

      const api = new ApiClient(serverUrl)
      const signInResult = await api.signIn(username, password)
      if (!signInResult.session.token) {
        throw Errors.internal('登录成功但未获取到 session token')
      }

      const path = saveCredentials({
        sessionToken: signInResult.session.token,
        sessionExpiresAt: signInResult.session.expiresAt,
        user: {
          id: signInResult.user.id,
          username: signInResult.user.username,
          displayName: signInResult.user.displayName,
          role: signInResult.user.role ?? 'member',
        },
        createdAt: new Date().toISOString(),
      })
      printInfo(
        `Logged in as ${signInResult.user.username}. Session stored at ${path}`,
        globalOpts,
      )
    })

  auth
    .command('whoami')
    .description('查看当前登录的用户')
    .action(async () => {
      const globalOpts = program.opts<OutputOpts & { server?: string }>()
      const serverUrl = resolveServerUrl(globalOpts)
      const api = new ApiClient(serverUrl)
      const user = await api.whoami()
      formatOutput(user, globalOpts)
    })

  auth
    .command('logout')
    .description('登出：撤销会话（best-effort）并删除本地凭据')
    .action(async () => {
      const globalOpts = program.opts<OutputOpts & { server?: string }>()
      const creds = loadCredentials()
      if (!creds) {
        printInfo('Not logged in.', globalOpts)
        return
      }
      try {
        const serverUrl = resolveServerUrl(globalOpts)
        const api = new ApiClient(serverUrl)
        await api.logout()
      } catch (err) {
        if (globalOpts.verbose) {
          process.stderr.write(
            `warn: failed to revoke session server-side: ${(err as Error).message}\n`,
          )
        }
      }
      clearCredentials()
      printInfo('Logged out.', globalOpts)
    })
}
