#!/usr/bin/env -S pnpm exec tsx
// biome-ignore lint/correctness/noUnusedImports: shebang is required for `bin`
import 'dotenv/config'
import { handleError } from './errors'
import { buildProgram } from './program'

async function main(): Promise<void> {
  const program = buildProgram()
  await program.parseAsync(process.argv)
}

main().catch((err: unknown) => {
  handleError(err)
})