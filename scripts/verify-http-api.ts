/**
 * End-to-end verification of the CLI HTTP API.
 *
 * Covers:
 *   - OpenAPI spec served at /api/v1/openapi/json
 *   - Every documented endpoint with bearer auth
 *   - Error response shape ({code, message, statusCode})
 *   - HTTP vs in-process CLI equivalence on a known input
 *
 * Usage: pnpm tsx scripts/verify-http-api.ts
 */
import { spawnSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const SERVER = process.env.DOCBASE_SERVER ?? 'http://localhost:3000'

interface Result {
  name: string
  pass: boolean
  detail?: string
}
const results: Result[] = []

function ok(name: string) {
  results.push({ name, pass: true })
  console.log(`✓ ${name}`)
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail })
  console.log(`✗ ${name}: ${detail}`)
}

interface FetchResult {
  status: number
  body: unknown
  raw: string
}
async function http(
  method: string,
  path: string,
  opts: { auth?: string; body?: unknown } = {},
): Promise<FetchResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.auth) headers.Authorization = `Bearer ${opts.auth}`
  const res = await fetch(`${SERVER}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    // keep raw
  }
  return { status: res.status, body: parsed, raw: text }
}

async function readApiKey(): Promise<string> {
  const { readFileSync } = await import('node:fs')
  const creds = JSON.parse(readFileSync(`${process.env.HOME}/.config/docbase/credentials.json`, 'utf8'))
  return creds.apiKey as string
}

async function main() {
  console.log(`--- Verifying CLI HTTP API against ${SERVER} ---\n`)

  // 1. OpenAPI spec
  {
    const r = await http('GET', '/api/v1/openapi/json')
    if (r.status !== 200) {
      fail('openapi spec serves', `status=${r.status}`)
    } else {
      const spec = r.body as { openapi: string; paths: Record<string, unknown>; components?: { securitySchemes?: Record<string, unknown> } }
      const pathCount = Object.keys(spec.paths ?? {}).length
      const hasBearer = Boolean(spec.components?.securitySchemes?.bearerAuth)
      if (spec.openapi === '3.0.3' && pathCount === 8 && hasBearer) {
        ok(`openapi 3.0.3 · ${pathCount} paths · bearerAuth scheme`)
      } else {
        fail('openapi spec content', `openapi=${spec.openapi} paths=${pathCount} bearer=${hasBearer}`)
      }
    }
  }

  const apiKey = await readApiKey()

  // 2. Auth — whoami with bad key returns 401 + ServerError shape
  {
    const r = await http('GET', '/api/v1/cli/auth/whoami', { auth: 'docbase_bogus' })
    if (r.status !== 401) {
      fail('whoami bad key → 401', `got status=${r.status}`)
    } else if (
      typeof r.body === 'object' && r.body !== null &&
      'code' in r.body && (r.body as { code: string }).code === 'UNAUTHENTICATED' &&
      'statusCode' in r.body && (r.body as { statusCode: number }).statusCode === 401
    ) {
      ok('whoami bad key → {code:"UNAUTHENTICATED", statusCode:401}')
    } else {
      fail('whoami bad key error shape', `body=${JSON.stringify(r.body)}`)
    }
  }

  // 3. whoami with real key
  {
    const r = await http('GET', '/api/v1/cli/auth/whoami', { auth: apiKey })
    if (r.status !== 200) {
      fail('whoami good key', `status=${r.status} body=${r.raw}`)
    } else {
      const user = r.body as { username?: string; role?: string }
      if (user.username === 'admin' && user.role === 'admin') {
        ok(`whoami good key → ${user.username}/${user.role}`)
      } else {
        fail('whoami good key shape', `body=${JSON.stringify(r.body)}`)
      }
    }
  }

  // 4. List spaces
  {
    const r = await http('GET', '/api/v1/cli/spaces', { auth: apiKey })
    if (r.status !== 200) {
      fail('list spaces', `status=${r.status}`)
    } else {
      const spaces = (r.body as { items: Array<{ name: string }> }).items
      const names = spaces.map((s) => s.name)
      const expected = ['产品知识库', '工程知识库', '安全与合规', '运营与市场', '通用规范']
      const okCount = expected.filter((n) => names.includes(n)).length
      if (okCount === 5) ok(`list spaces → 5 expected names all present`)
      else fail('list spaces content', `got ${names.join(', ')}`)
    }
  }

  // 5. List tags
  {
    const r = await http('GET', '/api/v1/cli/tags?limit=50', { auth: apiKey })
    if (r.status !== 200) {
      fail('list tags', `status=${r.status}`)
    } else {
      const tags = (r.body as { items: Array<{ name: string }> }).items
      ok(`list tags → ${tags.length} tag(s)`)
    }
  }

  // 6. Create space (admin path)
  const createdSpaceName = `__verify_test_space_${Date.now()}`
  let createdSpaceId = ''
  {
    const r = await http('POST', '/api/v1/cli/spaces', {
      auth: apiKey,
      body: { name: createdSpaceName },
    })
    if (r.status !== 201) {
      fail('create space', `status=${r.status} body=${r.raw}`)
    } else {
      const resp = r.body as { space: { id: string; name: string } }
      createdSpaceId = resp.space.id
      if (resp.space.name === createdSpaceName) ok(`create space → id=${resp.space.id.slice(0, 8)}…`)
      else fail('create space content', JSON.stringify(resp))
    }
  }

  // 7. Create category under that space
  const createdCategoryName = `__verify_test_cat_${Date.now()}`
  {
    if (!createdSpaceId) {
      fail('create category', 'skipped — no space')
    } else {
      const r = await http('POST', `/api/v1/cli/spaces/${createdSpaceId}/categories`, {
        auth: apiKey,
        body: { name: createdCategoryName },
      })
      if (r.status !== 201) {
        fail('create category', `status=${r.status} body=${r.raw}`)
      } else {
        ok(`create category → status 201`)
      }
    }
  }

  // 8. Create tag (idempotent — same tag created twice should not 5xx)
  {
    const tagName = `__verify_test_tag_${Date.now()}`
    const r1 = await http('POST', '/api/v1/cli/tags', { auth: apiKey, body: { name: tagName } })
    const r2 = await http('POST', '/api/v1/cli/tags', { auth: apiKey, body: { name: tagName } })
    if (r1.status === 201 && r2.status === 201) {
      ok(`create tag idempotent → both 201`)
    } else {
      fail('create tag idempotent', `r1=${r1.status} r2=${r2.status}`)
    }
  }

  // 9. Create document
  {
    if (!createdSpaceId) {
      fail('create document', 'skipped — no space')
    } else {
      const r = await http('POST', '/api/v1/cli/documents', {
        auth: apiKey,
        body: {
          title: `__verify_test_doc_${Date.now()}`,
          contentMarkdown: '# Hello\n\nThis is a test.',
          spaceId: createdSpaceId,
          status: 'published',
          tags: [],
        },
      })
      if (r.status !== 201) {
        fail('create document', `status=${r.status} body=${r.raw}`)
      } else {
        ok(`create document → status 201`)
      }
    }
  }

  // 10. Validation error → 400 with code VALIDATION_ERROR
  {
    const r = await http('POST', '/api/v1/cli/spaces', {
      auth: apiKey,
      body: { name: '' }, // empty name — zod min(1) should reject
    })
    if (r.status !== 400) {
      fail('validation 400', `status=${r.status} body=${r.raw}`)
    } else if (
      typeof r.body === 'object' && r.body !== null &&
      'code' in r.body && (r.body as { code: string }).code === 'VALIDATION_ERROR'
    ) {
      ok(`empty name → 400 VALIDATION_ERROR`)
    } else {
      fail('validation error shape', JSON.stringify(r.body))
    }
  }

  // 11. CLI HTTP path — invoke `pnpm cli --server` and check it works
  // (We skip this here because the shell loop earlier covered it; instead
  //  we run CLI *in-process* to ensure that path still works.)
  {
    const res = spawnSync('pnpm', ['cli', 'space', 'list'], {
      encoding: 'utf8',
      timeout: 20_000,
      env: { ...process.env, // strip DOCBASE_SERVER to force in-process path
        DOCBASE_SERVER: '' },
    })
    const stdout = res.stdout ?? ''
    if (res.status === 0 && stdout.includes('产品知识库')) {
      ok('CLI in-process fallback still works (no DOCABASE_SERVER)')
    } else {
      fail('CLI in-process fallback', `exit=${res.status} stdout=${stdout.slice(-200)}`)
    }
  }

  // 12. CLI HTTP path via env
  {
    const res = spawnSync('pnpm', ['cli', 'space', 'list'], {
      encoding: 'utf8',
      timeout: 20_000,
      env: { ...process.env, DOCBASE_SERVER: SERVER },
    })
    const stdout = res.stdout ?? ''
    if (res.status === 0 && stdout.includes('产品知识库')) {
      ok('CLI HTTP mode via DOCABASE_SERVER env works')
    } else {
      fail('CLI HTTP mode via env', `exit=${res.status} stdout=${stdout.slice(-200)}`)
    }
  }

  // Cleanup — delete the verify-test space (server cascades to categories)
  // (No delete endpoint exposed in this verify pass; idempotent test data is OK.)

  // Summary
  console.log('\n--- Summary ---')
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(`${passed} passed · ${failed} failed (total ${results.length})`)
  if (failed > 0) {
    console.log('\nFailures:')
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  · ${r.name}: ${r.detail}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('verify-http-api failed:', err)
  process.exit(1)
})

void sleep
