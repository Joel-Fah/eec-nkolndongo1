import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown.ts'

describe('help markdown', () => {
  it('renders headings, lists, notes and emphasis', () => {
    const { title, html } = renderMarkdown('# Titre\n\nUn **mot**.\n\n1. un\n2. deux\n\n> note')
    expect(title).toBe('Titre')
    expect(html).toContain('<strong>mot</strong>')
    expect(html).toContain('<ol>')
    expect(html).toContain('class="help-note"')
  })
  it('escapes raw HTML and refuses javascript: links', () => {
    const { html } = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1))')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href="javascript')
  })
})
