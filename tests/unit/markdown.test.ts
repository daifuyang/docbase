import { describe, expect, it } from 'vitest'
import { markdownToTiptap, parseFrontmatter } from '~/cli/markdown'

describe('parseFrontmatter', () => {
  it('parses title, status, tags, space from YAML', () => {
    const src = `---
title: My Doc
status: draft
tags: [a, b]
space: 产品知识库
---
# Hello`
    const { data, body } = parseFrontmatter(src)
    expect(data.title).toBe('My Doc')
    expect(data.status).toBe('draft')
    expect(data.tags).toEqual(['a', 'b'])
    expect(data.space).toBe('产品知识库')
    expect(body).toContain('# Hello')
  })

  it('throws when title is missing', () => {
    expect(() => parseFrontmatter('---\nfoo: bar\n---\nbody')).toThrow(/title/)
  })

  it('throws when status is invalid', () => {
    expect(() => parseFrontmatter('---\ntitle: t\nstatus: archived\n---\n')).toThrow(/status/)
  })

  it('throws when tags is not an array', () => {
    expect(() => parseFrontmatter('---\ntitle: t\ntags: "oops"\n---\n')).toThrow(/tags/)
  })
})

describe('markdownToTiptap', () => {
  it('converts a heading to a heading node', () => {
    const doc = markdownToTiptap('# Hello')
    expect(doc.type).toBe('doc')
    const first = doc.content?.[0]
    expect(first?.type).toBe('heading')
    expect((first?.attrs as { level: number }).level).toBe(1)
  })

  it('converts bold/em/code marks', () => {
    const doc = markdownToTiptap('**bold** *em* `code`')
    expect(doc.type).toBe('doc')
    // Walk the doc and collect all mark types present.
    const marks: string[] = []
    const walk = (n: { marks?: { type: string }[]; content?: unknown[] }) => {
      if (n.marks) for (const m of n.marks) marks.push(m.type)
      if (n.content)
        for (const c of n.content) walk(c as { marks?: { type: string }[]; content?: unknown[] })
    }
    walk(doc as { marks?: { type: string }[]; content?: unknown[] })
    // marked + generateJSON may produce separate text nodes per mark;
    // we just check that all three marks appear somewhere in the doc.
    expect(marks).toEqual(expect.arrayContaining(['bold', 'italic', 'code']))
  })

  it('converts an unordered list', () => {
    const doc = markdownToTiptap('- a\n- b\n- c')
    const list = doc.content?.[0]
    expect(list?.type).toBe('bulletList')
    expect((list?.content ?? []).length).toBe(3)
  })

  it('converts a fenced code block', () => {
    const doc = markdownToTiptap('```js\nconsole.log(1)\n```')
    const block = doc.content?.[0]
    expect(block?.type).toBe('codeBlock')
  })

  it('returns an empty paragraph for empty input', () => {
    const doc = markdownToTiptap('')
    expect(doc.type).toBe('doc')
    expect(doc.content?.length).toBeGreaterThan(0)
  })
})
