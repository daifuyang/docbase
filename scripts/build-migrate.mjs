#!/usr/bin/env node
/**
 * Build the FC deployable artifact under `fc-deploy-migrate/code/`.
 *
 * Outputs (mounted as `/code/` in the FC container):
 *   fc-deploy-migrate/code/
 *     bootstrap              ← bash launcher, chmod +x
 *     index.mjs              ← drizzle-kit migrate runner
 *     db/migrations/          ← single source of truth for schema deltas
 *
 * Calls:
 *   pnpm build:migrate
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_CODE = path.join(ROOT, 'fc-deploy-migrate', 'code')
const OUT = path.join(ROOT, 'fc-deploy-migrate', 'code')

function rmrf(p) {
  return fs.rm(p, { recursive: true, force: true })
}
function ensureDir(p) {
  return fs.mkdir(p, { recursive: true })
}
async function cpDir(src, dst) {
  await ensureDir(dst)
  await fs.cp(src, dst, { recursive: true })
}

async function main() {
  console.log('▶ build:migrate — assembling fc-deploy-migrate/code/')

  // The output directory overlaps the source — only the freshly-built
  // files live in code/ at deploy time (bootstrap, index.mjs, db/).
  // We DO NOT delete OUT/SRC_CODE's bootstrap + index.mjs here; the
  // build only refreshes db/migrations + re-chmods bootstrap.
  await ensureDir(OUT)

  // 1) db/migrations/ — single source of truth for schema deltas.
  await cpDir(path.join(ROOT, 'db', 'migrations'), path.join(OUT, 'db', 'migrations'))
  console.log('  ✓ db/migrations/ copied')

  // 2) bootstrap needs to be executable.
  const bootstrapPath = path.join(OUT, 'bootstrap')
  try {
    await fs.chmod(bootstrapPath, 0o755)
    console.log('  ✓ bootstrap chmod +x')
  } catch (error) {
    console.error('✗ bootstrap missing or not chmod-able:', bootstrapPath, error)
    process.exit(1)
  }

  console.log('')
  console.log('✅ fc-deploy-migrate/code/ ready for `s deploy -y`')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})