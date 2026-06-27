// Unit test for HTML sanitization
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '~/lib/sanitize.server'

describe('sanitizeHtml', () => {
  it('allows basic tags', () => {
    const safe = '<p>hello <strong>world</strong></p>'
    expect(sanitizeHtml(safe)).toBe('<p>hello <strong>world</strong></p>')
  })

  it('strips <script>', () => {
    const html = '<p>safe</p><script>alert(1)</script>'
    const result = sanitizeHtml(html)
    expect(result).not.toContain('<script>')
    expect(result).toContain('safe')
  })

  it('strips javascript: protocol from links', () => {
    const html = '<a href="javascript:alert(1)">click</a>'
    const result = sanitizeHtml(html)
    expect(result).not.toContain('javascript:')
  })

  it('adds rel and target to links', () => {
    const html = '<a href="https://example.com">x</a>'
    const result = sanitizeHtml(html)
    expect(result).toContain('rel="nofollow noopener"')
    expect(result).toContain('target="_blank"')
  })
})
