import type { Command } from 'commander'
import { registerAuthCommands } from './auth'
import { registerDocCommands } from './doc'
import { registerSpaceCommands } from './space'
import { registerTagCommands } from './tag'

export function registerCommands(program: Command): void {
  registerAuthCommands(program)
  registerSpaceCommands(program)
  registerTagCommands(program)
  registerDocCommands(program)
}