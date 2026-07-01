#!/usr/bin/env node
/**
 * Build the FC layer.
 *
 * Output structure (matches s.yaml's `code: ./.fc-code`):
 *   .fc-code/
 *     dist/                  ← TanStack Start build output
 *     db/migrations/         ← Drizzle migrations used by the installer
 *     fc-server.mjs          ← http server wrapping tanstack fetch
 *     bootstrap              ← bash launcher (chmod +x)
 *     package.json           ← { "type": "module" } for ESM
 *
 * 与 codecloaud 的部署配方一致：
 *   - 不用把 node_modules 塞进 .fc-code (vite 已经把 server deps 打进 dist/server/server.js)
 *   - 不用打包 zip, s deploy 自己处理
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, '.fc-code')

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

async function main() {
  console.log('▶ build:fc — assembling .fc-code/')

  await rmrf(OUT)
  await ensureDir(OUT)

  // 1) dist/ -> .fc-code/dist/
  const distSrc = path.join(ROOT, 'dist')
  try {
    await cpDir(distSrc, path.join(OUT, 'dist'))
    console.log('  ✓ dist/ copied')
  } catch (e) {
    console.error('✗ dist/ not found — run `pnpm build` first')
    process.exit(1)
  }

  // 2) db/migrations/ -> .fc-code/db/migrations/
  const migrationsSrc = path.join(ROOT, 'db', 'migrations')
  try {
    await cpDir(migrationsSrc, path.join(OUT, 'db', 'migrations'))
    console.log('  ✓ db/migrations/ copied')
  } catch (e) {
    console.error('✗ db/migrations/ not found — run `pnpm db:generate` first')
    process.exit(1)
  }

  // 3) fc-server.mjs (已经写成 ./dist/server/server.js 的相对路径)
  const serverSrc = await fs.readFile(path.join(ROOT, 'server', 'fc-server.mjs'), 'utf8')
  await fs.writeFile(path.join(OUT, 'fc-server.mjs'), clean(serverSrc))
  console.log('  ✓ fc-server.mjs copied')

  // 4) bootstrap (chmod +x)
  const bootstrapSrc = await fs.readFile(path.join(ROOT, 'server', 'bootstrap'), 'utf8')
  await fs.writeFile(path.join(OUT, 'bootstrap'), clean(bootstrapSrc))
  await fs.chmod(path.join(OUT, 'bootstrap'), 0o755)
  console.log('  ✓ bootstrap copied (+x)')

  // 5) package.json (full deps — same as repo, so pnpm install --prod installs
  //    react / @tanstack/* / drizzle / ioredis / etc. into .fc-code/node_modules)
  const repoPkg = JSON.parse(
    await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'),
  )
  // 同时包含 dependencies 和 devDependencies —— vite build 会把 dotenv 等 dev
  // 依赖声明为 external（运行时从 node_modules 加载），缺一个就会 ERR_MODULE_NOT_FOUND
  const fcPkg = {
    name: repoPkg.name + '-fc',
    version: repoPkg.version,
    private: true,
    type: 'module',
    engines: repoPkg.engines,
    dependencies: { ...repoPkg.dependencies, ...repoPkg.devDependencies },
  }
  await fs.writeFile(path.join(OUT, 'package.json'), JSON.stringify(fcPkg, null, 2))
  console.log('  ✓ package.json copied (with all prod deps)')

  // 6) node_modules — vite build 把 react / @tanstack/* 设为 external,
  //    运行时 `/code/node_modules` 必须能解析这些包。
  //    在 .fc-code 跑 `pnpm install --prod`（不要 --frozen-lockfile，因为我们的
  //    精简 package.json 与 repo 的 lockfile 不一致；不更新 lockfile 就 OK）。
  console.log('  ⏳ pnpm install --prod (populating .fc-code/node_modules)')
  const { default: cp } = await import('node:child_process')
  await new Promise((resolve, reject) => {
    const child = cp.spawn(
      'pnpm',
      ['install', '--prod', '--ignore-scripts'],
      { cwd: OUT, stdio: 'inherit', env: { ...process.env, CI: '1' } },
    )
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('pnpm install exited ' + code)),
    )
  })
  console.log('  ✓ node_modules ready')

  console.log('✅ .fc-code/ ready for `s deploy`')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
