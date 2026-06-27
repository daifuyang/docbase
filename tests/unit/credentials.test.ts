import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearCredentials,
  credentialsPath,
  loadCredentials,
  saveCredentials,
} from '~/cli/credentials'
import type { Credentials } from '~/cli/types'

const FAKE: Credentials = {
  apiKey: 'docbase_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  apiKeyId: 'apikey_test_123',
  prefix: 'docbase_',
  user: {
    id: 'user_test',
    username: 'tester',
    displayName: 'Tester',
    role: 'admin',
  },
  createdAt: '2026-06-27T00:00:00Z',
}

describe('credentials', () => {
  const tmpPath = join(tmpdir(), `docbase-test-${Date.now()}-creds.json`)

  beforeEach(() => {
    process.env.DOCBASE_CREDENTIALS_PATH = tmpPath
  })

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: test cleanup
    delete process.env.DOCBASE_CREDENTIALS_PATH
    if (existsSync(tmpPath)) unlinkSync(tmpPath)
  })

  it('returns null when no credentials file exists', () => {
    expect(loadCredentials()).toBeNull()
  })

  it('round-trips save -> load', () => {
    saveCredentials(FAKE)
    const loaded = loadCredentials()
    expect(loaded).toEqual(FAKE)
  })

  it('writes file with mode 0o600 on POSIX', () => {
    if (process.platform === 'win32') return
    saveCredentials(FAKE)
    const stat = statSync(tmpPath)
    // mask to permission bits only
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it('clearCredentials removes the file', () => {
    saveCredentials(FAKE)
    expect(existsSync(tmpPath)).toBe(true)
    clearCredentials()
    expect(existsSync(tmpPath)).toBe(false)
  })

  it('create parent directories if missing', () => {
    const stamp = Date.now()
    const nested = join(tmpdir(), `docbase-nested-${stamp}`, 'sub', 'creds.json')
    process.env.DOCBASE_CREDENTIALS_PATH = nested
    saveCredentials(FAKE)
    expect(existsSync(nested)).toBe(true)
    // Verify the parent directory was created with mkdirSync recursive
    expect(existsSync(join(tmpdir(), `docbase-nested-${stamp}`, 'sub'))).toBe(true)
  })

  it('loadCredentials returns null for invalid JSON', () => {
    saveCredentials(FAKE)
    // Corrupt the file
    const fs = require('node:fs') as typeof import('node:fs')
    fs.writeFileSync(tmpPath, 'not-json')
    expect(loadCredentials()).toBeNull()
  })

  it('credentialsPath honors DOCBASE_CREDENTIALS_PATH', () => {
    process.env.DOCBASE_CREDENTIALS_PATH = '/custom/path/creds.json'
    expect(credentialsPath()).toBe('/custom/path/creds.json')
  })

  it('reads back the actual on-disk file content', () => {
    saveCredentials(FAKE)
    const raw = JSON.parse(readFileSync(tmpPath, 'utf8')) as Credentials
    expect(raw.apiKey).toBe(FAKE.apiKey)
  })
})
