/**
 * auth login / whoami / logout
 */
import type { Command } from 'commander'
import { Errors } from '~/lib/errors'
import { revokeApiKeyService } from '~/server/services/auth'
import { contextFromHeaders } from '~/server/services/context'
import { clearCredentials, loadCredentials, saveCredentials } from '../credentials'
import { ApiClient } from '../api-client'
import { formatOutput, printInfo } from '../output'
import { promptHidden } from '../prompt'
import type { OutputOpts } from '../types'

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('认证与 API Key 管理')

  auth
    .command('login')
    .description('使用账号密码登录并生成 API Key 存储到本地')
    .option('--username <account>', '用户名或邮箱')
    .option('--password <pwd>', '密码（省略则交互输入）')
    .option('--name <name>', '为该 API Key 命名', 'cli')
    .action(async (opts: { username?: string; password?: string; name?: string }) => {
      const globalOpts = program.opts<OutputOpts>()
      const username = opts.username
      if (!username) throw Errors.validation('请提供 --username <账号>')
      const password = opts.password ?? (await promptHidden('Password: '))
      const api = new ApiClient()
      const signInResult = await api.signIn(username, password)
      const apiKey = await api.createApiKey({
        userId: signInResult.user.id,
        name: opts.name ?? 'cli',
      })
      const path = saveCredentials({
        apiKey: apiKey.key,
        apiKeyId: apiKey.id,
        prefix: apiKey.prefix,
        expiresAt: apiKey.expiresAt,
        user: {
          id: signInResult.user.id,
          username: signInResult.user.username,
          displayName: signInResult.user.displayName,
          role: signInResult.user.role ?? 'member',
        },
        createdAt: new Date().toISOString(),
      })
      printInfo(
        `Logged in as ${signInResult.user.username}. API key stored at ${path}`,
        globalOpts,
      )
    })

  auth
    .command('whoami')
    .description('查看当前登录的用户')
    .action(async () => {
      const globalOpts = program.opts<OutputOpts>()
      const api = new ApiClient()
      const user = await api.whoami()
      formatOutput(user, globalOpts)
    })

  auth
    .command('logout')
    .description('登出：撤销 API Key 并删除本地凭据')
    .action(async () => {
      const globalOpts = program.opts<OutputOpts>()
      const creds = loadCredentials()
      if (!creds) {
        printInfo('Not logged in.', globalOpts)
        return
      }
      try {
        const headers = new Headers()
        headers.set('x-api-key', creds.apiKey)
        const ctx = await contextFromHeaders(headers)
        await revokeApiKeyService(ctx, { keyId: creds.apiKeyId })
      } catch (err) {
        // best effort — even if revocation fails, clear local file
        if (globalOpts.verbose) {
          process.stderr.write(`warn: failed to revoke key server-side: ${(err as Error).message}\n`)
        }
      }
      clearCredentials()
      printInfo('Logged out.', globalOpts)
    })
}
