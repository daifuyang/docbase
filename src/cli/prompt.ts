/**
 * Password prompt.
 * Uses /dev/tty if available, otherwise falls back to plain stdin.
 */
import { createInterface } from 'node:readline'

export async function promptHidden(question: string): Promise<string> {
  process.stderr.write(question)
  return readLine()
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: false,
    })
    rl.question('', (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}