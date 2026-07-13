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

  it('preserves table structure and aggregate attributes', () => {
    const html = `
      <table class="doc-table">
        <thead>
          <tr><th>部门</th><th data-col-agg="sum">金额</th></tr>
        </thead>
        <tbody>
          <tr><td>研发</td><td data-type="number">100</td></tr>
          <tr data-row-kind="subtotal"><td>小计</td><td data-type="number">100</td></tr>
        </tbody>
      </table>
    `
    const result = sanitizeHtml(html)
    expect(result).toContain('<table')
    expect(result).toContain('<th')
    expect(result).toContain('data-col-agg="sum"')
    expect(result).toContain('data-type="number"')
    expect(result).toContain('data-row-kind="subtotal"')
  })

  it('strips script payloads nested in tables', () => {
    const html = `
      <table>
        <tr><td><script>alert(1)</script>10</td></tr>
      </table>
    `
    const result = sanitizeHtml(html)
    expect(result).not.toContain('<script>')
    expect(result).toContain('10')
  })
})
