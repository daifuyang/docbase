/**
 * URL-safe slug generator.
 * - Lowercases
 * - Replaces non-alphanumeric runs with single hyphens
 * - Trims hyphens
 * - Strips CJK / non-ASCII chars (caller should pass transliterated or English title)
 *   For pure CJK titles, falls back to a short hash.
 */
import { createHash } from 'node:crypto'

export function slugify(input: string): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  if (ascii.length > 0) return ascii

  // Fallback for CJK-only or other non-ASCII titles
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 10)
  return `document-${hash}`
}

/**
 * Given an existing slug, return the next available slug with a numeric suffix.
 * Caller is responsible for checking the DB for the first available one.
 */
export function withSuffix(base: string, n: number): string {
  return `${base}-${n}`
}
