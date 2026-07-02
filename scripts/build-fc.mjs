#!/usr/bin/env node
/**
 * Build the FC deployable runtime artifact under `fc-deploy/code/`.
 *
 * 输出结构（与 fc-deploy/s.yaml 的 `code: ./code` 对应）：
 *   fc-deploy/code/
 *     bootstrap             ← bash launcher (chmod +x)，FC custom.debian12 入口
 *     .output/              ← TanStack Start + Nitro production output
 *     db/migrations/        ← Drizzle migrations
 *     package.json          ← minimal metadata / start script
 *
 * 注意：FC 会把 s.yaml 的 `code: ./code` 挂载为 `/code`，
 * 所以 bootstrap 必须位于 fc-deploy/code/bootstrap。
 *
 * fc-deploy/ 顶层由用户手维护的文件（s.yaml / .env.example / .gitignore /
 * README.md / prod.env）不会被本脚本删除，也不会被上传到 FC。
 *
 * 调用：
 *   pnpm build:fc                # 仅生成 fc-deploy/code/
 *   pnpm build:fc:local          # = pnpm build && node scripts/build-fc.mjs
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEPLOY_DIR = path.join(ROOT, 'fc-deploy')
const OUT = path.join(DEPLOY_DIR, 'code')

function clean(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true })
}
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true })
}
async function cpDir(src, dst) {
  await ensureDir(dst)
  await fs.cp(src, dst, { recursive: true })
}
async function assertFile(p, label) {
  const stat = await fs.stat(p).catch(() => null)
  if (!stat?.isFile()) {
    throw new Error(`${label} not found: ${path.relative(ROOT, p)}`)
  }
}
async function assertDir(p, label) {
  const stat = await fs.stat(p).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new Error(`${label} not found: ${path.relative(ROOT, p)}`)
  }
}

// 仅清掉运行时代码包；fc-deploy/ 顶层的配置、文档和本地凭证不会进入 FC 代码包。
async function cleanBuildArtifacts() {
  await rmrf(OUT)
  for (const sub of [
    '.code',
    '.output',
    'dist',
    'db',
    'node_modules',
    'package.json',
    'pnpm-lock.yaml',
    'bootstrap',
    'fc-server.mjs',
  ]) {
    await rmrf(path.join(DEPLOY_DIR, sub))
  }
}

async function main() {
  console.log('▶ build:fc — assembling fc-deploy/code/')

  await cleanBuildArtifacts()
  await ensureDir(OUT)

  // 1) .output/ → fc-deploy/code/.output/
  const outputSrc = path.join(ROOT, '.output')
  try {
    await cpDir(outputSrc, path.join(OUT, '.output'))
    console.log('  ✓ .output/ copied')
  } catch (e) {
    console.error('✗ .output/ not found — run `pnpm build` first')
    process.exit(1)
  }

  // 2) db/migrations/ → fc-deploy/code/db/migrations/
  const migrationsSrc = path.join(ROOT, 'db', 'migrations')
  try {
    await cpDir(migrationsSrc, path.join(OUT, 'db', 'migrations'))
    console.log('  ✓ db/migrations/ copied')
  } catch (e) {
    console.error('✗ db/migrations/ not found — run `pnpm db:generate` first')
    process.exit(1)
  }

  // 3) bootstrap (FC custom.debian12 入口，chmod +x)
  const bootstrapSrc = await fs.readFile(path.join(ROOT, 'server', 'bootstrap'), 'utf8')
  await fs.writeFile(path.join(OUT, 'bootstrap'), clean(bootstrapSrc))
  await fs.chmod(path.join(OUT, 'bootstrap'), 0o755)
  console.log('  ✓ bootstrap copied (+x)')

  // 4) package.json — Nitro noExternals bundles runtime code into .output/server.
  // Keep only minimal metadata so local tooling still has a clear start command.
  const repoPkg = JSON.parse(
    await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'),
  )
  const fcPkg = {
    name: 'docbase-fc-deploy',
    version: repoPkg.version,
    private: true,
    type: 'module',
    engines: { node: '>=20' },
    scripts: {
      start: 'node .output/server/index.mjs',
    },
  }
  await fs.writeFile(path.join(OUT, 'package.json'), JSON.stringify(fcPkg, null, 2))
  console.log('  ✓ package.json written (Nitro bundled runtime)')

  await assertFile(path.join(OUT, 'bootstrap'), 'FC bootstrap')
  await assertFile(path.join(OUT, '.output', 'server', 'index.mjs'), 'TanStack Start server entry')
  await assertDir(path.join(OUT, '.output', 'public'), 'TanStack Start public assets')
  await assertDir(path.join(OUT, 'db', 'migrations'), 'Drizzle migrations')

  const manifest = {
    app: 'docbase',
    target: 'aliyun-fc-custom-runtime',
    framework: 'tanstack-start',
    generatedAt: new Date().toISOString(),
    entry: '.output/server/index.mjs',
    port: 9000,
    node: process.version,
  }
  await fs.writeFile(path.join(OUT, 'fc-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('  ✓ deploy artifact verified')

  console.log('')
  console.log('✅ fc-deploy/code/ ready for `s local start`')
  console.log('   next: cd fc-deploy && s local start --env-file .env')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
