#!/usr/bin/env node
/**
 * Build the FC deployable artifact under `fc-deploy/`.
 *
 * 输出结构（与 fc-deploy/s.yaml 的 `code: .` 对应）：
 *   fc-deploy/
 *     bootstrap             ← bash launcher (chmod +x)，FC custom.debian12 入口
 *     fc-server.mjs         ← http server wrapping tanstack fetch
 *     dist/                 ← TanStack Start build output (server.js + assets/)
 *     db/migrations/        ← Drizzle migrations
 *     package.json          ← { type: module, dependencies merged }
 *     node_modules/         ← pnpm install --prod (--ignore-scripts)
 *
 * 注意：bootstrap / fc-server.mjs 放在 fc-deploy/ 根（与历史 .fc-code/ 布局
 * 一致），因为 bootstrap 里写死 `cd /code; node fc-server.mjs`。
 *
 * fc-deploy/ 顶层由用户手维护的文件（s.yaml / .env.example / .gitignore /
 * README.md）不会被本脚本删除——只重建构建产物。
 *
 * 调用：
 *   pnpm build:fc                # 仅生成 fc-deploy/
 *   pnpm build:fc:local          # = pnpm build && node scripts/build-fc.mjs
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'fc-deploy')

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

// 仅清掉构建产物（保留 s.yaml / server-bootstrap / .env.example / README.md 等手维护文件）
async function cleanBuildArtifacts() {
  for (const sub of ['dist', 'db', 'node_modules', 'package.json', 'pnpm-lock.yaml', 'bootstrap', 'fc-server.mjs']) {
    await rmrf(path.join(OUT, sub))
  }
}

async function main() {
  console.log('▶ build:fc — assembling fc-deploy/')

  await ensureDir(OUT)
  await cleanBuildArtifacts()

  // 1) dist/ → fc-deploy/dist/
  const distSrc = path.join(ROOT, 'dist')
  try {
    await cpDir(distSrc, path.join(OUT, 'dist'))
    console.log('  ✓ dist/ copied')
  } catch (e) {
    console.error('✗ dist/ not found — run `pnpm build` first')
    process.exit(1)
  }

  // 2) db/migrations/ → fc-deploy/db/migrations/
  const migrationsSrc = path.join(ROOT, 'db', 'migrations')
  try {
    await cpDir(migrationsSrc, path.join(OUT, 'db', 'migrations'))
    console.log('  ✓ db/migrations/ copied')
  } catch (e) {
    console.error('✗ db/migrations/ not found — run `pnpm db:generate` first')
    process.exit(1)
  }

  // 3) fc-server.mjs (从仓库根 server/ 复制到 fc-deploy/ 根)
  const serverSrc = await fs.readFile(path.join(ROOT, 'server', 'fc-server.mjs'), 'utf8')
  await fs.writeFile(path.join(OUT, 'fc-server.mjs'), clean(serverSrc))
  console.log('  ✓ fc-server.mjs copied')

  // 4) bootstrap (FC custom.debian12 入口，chmod +x)
  const bootstrapSrc = await fs.readFile(path.join(ROOT, 'server', 'bootstrap'), 'utf8')
  await fs.writeFile(path.join(OUT, 'bootstrap'), clean(bootstrapSrc))
  await fs.chmod(path.join(OUT, 'bootstrap'), 0o755)
  console.log('  ✓ bootstrap copied (+x)')

  // 5) package.json（合成 deps + devDeps）
  // vite build 把 react / @tanstack/* / drizzle / dotenv 等设为 external，
  // 运行时 /code/node_modules 必须能解析这些包；缺一个就 ERR_MODULE_NOT_FOUND。
  const repoPkg = JSON.parse(
    await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'),
  )
  const fcPkg = {
    name: 'docbase-fc-deploy',
    version: repoPkg.version,
    private: true,
    type: 'module',
    engines: { node: '>=20' },
    dependencies: { ...repoPkg.dependencies, ...repoPkg.devDependencies },
  }
  await fs.writeFile(path.join(OUT, 'package.json'), JSON.stringify(fcPkg, null, 2))
  console.log('  ✓ package.json copied (with all prod deps)')

  // 6) node_modules — 必须 --ignore-scripts（避免 husky postinstall），
  //    必须 --no-frozen-lockfile（合成 package.json 与 repo 的 lockfile 不一致）。
  console.log('  ⏳ pnpm install --prod (populating fc-deploy/node_modules)')
  await new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        'install',
        '--prod',
        '--ignore-scripts',
        '--no-frozen-lockfile',
        '--ignore-workspace',
      ],
      { cwd: OUT, stdio: 'inherit', env: { ...process.env, CI: '1' } },
    )
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('pnpm install exited ' + code)),
    )
  })
  console.log('  ✓ node_modules ready')

  console.log('')
  console.log('✅ fc-deploy/ ready for `s local start`')
  console.log('   next: cd fc-deploy && s local start --env-file .env')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})