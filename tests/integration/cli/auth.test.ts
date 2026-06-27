// Integration test for the `auth` CLI command family.
// Requires the DB to be seeded with `pnpm db:seed` first.
import { existsSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli } from '../../fixtures/cli-helpers'

const credsPath = join(tmpdir(), `docbase-cli-test-${Date.now()}.json`)

describe('CLI auth', () => {
  beforeAll(() => {
    if (existsSync(credsPath)) unlinkSync(credsPath)
  })

  afterAll(() => {
    if (existsSync(credsPath)) unlinkSync(credsPath)
  })

  it('whoami fails (exit 4) when not logged in', async () => {
    const result = await runCli(['auth', 'whoami'], { DOCBASE_CREDENTIALS_PATH: credsPath })
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/unauthenticated|未登录/i)
  }, 60_000)

  it('login stores a credentials file with mode 0o600', async () => {
    const result = await runCli(
      ['auth', 'login', '--username', 'admin', '--password', 'admin123'],
      { DOCBASE_CREDENTIALS_PATH: credsPath },
    )
    expect(result.code, `stderr: ${result.stderr}`).toBe(0)
    expect(existsSync(credsPath)).toBe(true)
    if (process.platform !== 'win32') {
      expect(statSync(credsPath).mode & 0o777).toBe(0o600)
    }
  }, 60_000)

  it('whoami succeeds after login', async () => {
    const result = await runCli(['auth', 'whoami', '--json'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    expect(result.code, `stderr: ${result.stderr}`).toBe(0)
    expect(result.stdout).toContain('admin')
  }, 60_000)
})
