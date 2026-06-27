// Integration test for the `doc` CLI command family.
// Requires `pnpm db:seed` to be run first.
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli } from '../../fixtures/cli-helpers'

const credsPath = join(tmpdir(), `docbase-cli-test-${Date.now()}.json`)
const samplePath = join(tmpdir(), `docbase-cli-sample-${Date.now()}.md`)

const SAMPLE_MD = `---
title: CLI integration test doc
tags: [cli-test]
status: published
space: 工程知识库
---

# Heading

**bold** _em_ \`code\` [link](https://example.com)

- item one
- item two
`

describe('CLI doc commands', () => {
  beforeAll(async () => {
    if (existsSync(credsPath)) unlinkSync(credsPath)
    if (existsSync(samplePath)) unlinkSync(samplePath)
    writeFileSync(samplePath, SAMPLE_MD, 'utf8')
    // Clean up any leftover docs (base + suffixed variants) from previous runs.
    const { eq, like } = await import('drizzle-orm')
    const { db } = await import('~/../db')
    const { document } = await import('~/../db/schema')
    const deleted = await db
      .delete(document)
      .where(like(document.slug, 'cli-integration-test-doc%'))
      .returning({ slug: document.slug })
      .catch((e: unknown) => {
        // biome-ignore lint/suspicious/noConsole: test diagnostics
        console.error('cleanup failed:', e)
        return []
      })
    // biome-ignore lint/suspicious/noConsole: test diagnostics
    console.log('cleanup deleted:', deleted.length, 'rows')
    const r = await runCli(['auth', 'login', '--username', 'admin', '--password', 'admin123'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    expect(r.code, `login failed: ${r.stderr}`).toBe(0)
    // silence unused
    void eq
  }, 60_000)

  afterAll(() => {
    // Best-effort cleanup
    if (existsSync(credsPath)) unlinkSync(credsPath)
    if (existsSync(samplePath)) unlinkSync(samplePath)
  })

  it('doc create from file returns a slug', async () => {
    const r = await runCli(['doc', 'create', '--from', samplePath, '--json'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    if (r.code !== 0) {
      // biome-ignore lint/suspicious/noConsole: test diagnostics
      console.error('CLI failed. Full stderr:')
      // biome-ignore lint/suspicious/noConsole: test diagnostics
      console.error(r.stderr)
      // biome-ignore lint/suspicious/noConsole: test diagnostics
      console.error('=== stdout ===')
      // biome-ignore lint/suspicious/noConsole: test diagnostics
      console.error(r.stdout)
    }
    expect(r.code, `stderr: ${r.stderr}`).toBe(0)
    expect(r.stdout).toMatch(/slug/)
    expect(r.stdout).toMatch(/cli-integration-test-doc/)
  }, 60_000)

  it('doc get returns HTML content for the created doc', async () => {
    const r = await runCli(['doc', 'get', 'cli-integration-test-doc', '--json'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    expect(r.code, `stderr: ${r.stderr}`).toBe(0)
    expect(r.stdout).toMatch(/contentHtml/)
    expect(r.stdout).toMatch(/<h1/)
  }, 60_000)

  it('doc delete removes the doc', async () => {
    const r = await runCli(['doc', 'delete', 'cli-integration-test-doc', '--yes'], {
      DOCBASE_CREDENTIALS_PATH: credsPath,
    })
    expect(r.code, `stderr: ${r.stderr}`).toBe(0)
  }, 60_000)
})
