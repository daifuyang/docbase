// Integration test for the `space` and `tag` CLI commands.
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli } from '../../fixtures/cli-helpers'

const credsPath = join(tmpdir(), `docbase-cli-test-${Date.now()}.json`)

describe('CLI space / tag', () => {
  beforeAll(async () => {
    if (existsSync(credsPath)) unlinkSync(credsPath)
    const r = await runCli(['auth', 'login', '--username', 'admin', '--password', 'admin123'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    expect(r.code, `login failed: ${r.stderr}`).toBe(0)
  }, 60_000)

  afterAll(() => {
    if (existsSync(credsPath)) unlinkSync(credsPath)
  })

  it('space list returns seeded spaces', async () => {
    const r = await runCli(['space', 'list', '--json'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    expect(r.code, `stderr: ${r.stderr}`).toBe(0)
    expect(r.stdout).toContain('产品知识库')
    expect(r.stdout).toContain('工程知识库')
  }, 60_000)

  it('tag list returns JSON with items array', async () => {
    const r = await runCli(['tag', 'list', '--json'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    expect(r.code, `stderr: ${r.stderr}`).toBe(0)
    expect(r.stdout).toMatch(/items/)
  }, 60_000)
})
