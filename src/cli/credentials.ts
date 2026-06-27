/**
 * Credentials file management.
 *
 * Stores the API key + user identity on disk so subsequent CLI invocations
 * don't need to sign in again. Path defaults to the XDG config dir
 * (~/.config/docbase/credentials.json) and is chmod 0o600 on POSIX.
 *
 * SECURITY: the file grants the same access as the user's account.
 * Anyone who can read the file can impersonate the user until `expiresAt`.
 * 0o600 is the only mitigation; rotate via `auth login` if compromised.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Credentials } from './types'

function defaultPath(): string {
  if (process.env.DOCBASE_CREDENTIALS_PATH) return process.env.DOCBASE_CREDENTIALS_PATH
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  return join(base, 'docbase', 'credentials.json')
}

export function credentialsPath(): string {
  return defaultPath()
}

export function loadCredentials(): Credentials | null {
  const p = defaultPath()
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Credentials
  } catch {
    return null
  }
}

export function saveCredentials(c: Credentials): string {
  const p = defaultPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(c, null, 2), { mode: 0o600 })
  try {
    chmodSync(p, 0o600)
  } catch {
    // POSIX only — silently no-op on Windows
  }
  return p
}

export function clearCredentials(): void {
  const p = defaultPath()
  if (existsSync(p)) unlinkSync(p)
}