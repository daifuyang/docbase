#!/usr/bin/env -S pnpm exec tsx
import 'dotenv/config'
import { handleError } from './errors'
import { buildProgram } from './program'

async function main(): Promise<void> {
  const program = buildProgram()
  let exitCode = 0
  try {
    await program.parseAsync(process.argv)
  } catch (err) {
    exitCode = 1
    handleError(err)
  } finally {
    process.exit(exitCode)
  }
}

main().catch((err: unknown) => {
  handleError(err)
})
