import { describe, expect, it } from 'vitest'
import { slugify, withSuffix } from '~/lib/slug.server'

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('truncates long inputs', () => {
    const long = 'a'.repeat(200)
    expect(slugify(long).length).toBeLessThanOrEqual(80)
  })

  it('falls back to hash for CJK-only titles', () => {
    const slug = slugify('中文标题')
    expect(slug).toMatch(/^document-[a-f0-9]{10}$/)
  })

  it('handles empty input', () => {
    expect(slugify('')).toBe('document-e3b0c44298') // sha256 of ''
  })
})

describe('withSuffix', () => {
  it('appends -2 to base', () => {
    expect(withSuffix('hello', 2)).toBe('hello-2')
  })
})
