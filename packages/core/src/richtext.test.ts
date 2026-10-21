import { describe, expect, it } from 'vitest'
import { cleanDoc, isEmptyDoc, plainText, renderHtml, safeHref } from './richtext.ts'

const p = (text: string, marks?: unknown[]) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, ...(marks ? { marks } : {}) }],
})

describe('safeHref', () => {
  it('accepts https, mailto, tel and site paths only', () => {
    expect(safeHref('https://example.org/a?b=1')).toBe('https://example.org/a?b=1')
    expect(safeHref('mailto:a@b.cm')).toBe('mailto:a@b.cm')
    expect(safeHref('tel:+237600000000')).toBe('tel:+237600000000')
    expect(safeHref('/fr/actualites')).toBe('/fr/actualites')
  })
  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html;base64,AAAA',
    '//evil.example',
    'http://insecure.example',
    'vbscript:x',
    '',
    'https://',
  ])('rejects %j', (h) => expect(safeHref(h)).toBeNull())
})

describe('hostile documents', () => {
  it('escapes markup typed as text', () => {
    const html = renderHtml({ type: 'doc', content: [p('<script>alert(1)</script> & "x"')] })
    expect(html).toBe('<p>&#60;script&#62;alert(1)&#60;/script&#62; &#38; &#34;x&#34;</p>')
  })
  it('drops dangerous links but keeps their text', () => {
    const html = renderHtml({
      type: 'doc',
      content: [p('click', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])],
    })
    expect(html).toBe('<p>click</p>')
  })
  it('opens external links safely', () => {
    const html = renderHtml({
      type: 'doc',
      content: [p('x', [{ type: 'link', attrs: { href: 'https://a.org/"onmouseover="x' } }])],
    })
    expect(html).not.toContain('"onmouseover')
    expect(html).toContain('rel="noopener noreferrer"')
  })
  it('drops unknown nodes, raw html nodes and extra attributes', () => {
    const doc = cleanDoc({
      type: 'doc',
      content: [
        { type: 'script', content: [{ type: 'text', text: 'x' }] },
        { type: 'html', attrs: { value: '<img onerror=x>' } },
        {
          type: 'paragraph',
          attrs: { onclick: 'x', style: 'color:red' },
          content: [{ type: 'text', text: 'ok' }],
        },
      ],
    })
    expect(JSON.stringify(doc)).not.toMatch(/onclick|style|script|html/)
    expect(renderHtml(doc)).toBe('<p>ok</p>')
  })
  it('only allows images from our media route', () => {
    const img = (src: string) => ({ type: 'image', attrs: { src, alt: '"><x' } })
    expect(renderHtml({ type: 'doc', content: [img('https://evil.example/a.png')] })).toBe('')
    expect(renderHtml({ type: 'doc', content: [img('/media/../etc/passwd')] })).toBe('')
    expect(renderHtml({ type: 'doc', content: [img('/media/photos/a.webp')] })).toContain(
      'alt="&#34;&#62;&#60;x"',
    )
  })
  it('survives garbage, deep nesting and huge input without throwing', () => {
    for (const x of [null, undefined, 1, 'x', [], { content: 'no' }, { content: [null, 1, 'a'] }])
      expect(cleanDoc(x)).toEqual({ type: 'doc', content: [] })
    let deep: unknown = p('deep')
    for (let i = 0; i < 100; i++) deep = { type: 'blockquote', content: [deep] }
    expect(() => renderHtml({ type: 'doc', content: [deep] })).not.toThrow()
    const many = { type: 'doc', content: Array.from({ length: 20000 }, () => p('a')) }
    expect(cleanDoc(many).content.length).toBeLessThanOrEqual(5000)
  })
  it('clamps heading levels', () => {
    const h = (level: number) =>
      renderHtml({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level }, content: [{ type: 'text', text: 'T' }] }],
      })
    expect(h(1)).toBe('<h2>T</h2>')
    expect(h(6)).toBe('<h2>T</h2>')
    expect(h(3)).toBe('<h3>T</h3>')
  })
})

describe('rendering', () => {
  it('renders marks, lists and quotes', () => {
    const html = renderHtml({
      type: 'doc',
      content: [
        p('a', [{ type: 'bold' }, { type: 'italic' }]),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('one')] }] },
        { type: 'blockquote', content: [p('q')] },
      ],
    })
    expect(html).toBe(
      '<p><em><strong>a</strong></em></p><ul><li><p>one</p></li></ul><blockquote><p>q</p></blockquote>',
    )
  })
  it('extracts plain text and detects empty documents', () => {
    const doc = { type: 'doc', content: [p('Hello'), p('world')] }
    expect(plainText(doc)).toBe('Hello world')
    expect(isEmptyDoc(doc)).toBe(false)
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'bulletList', content: [] }] })).toBe(true)
  })
})
