/**
 * A very small Markdown renderer for the help guides (written in this repository, so trusted, but escaped anyway).
 * Supports: # ## ### headings, paragraphs, - and 1. lists, > notes, **bold**, *italic*, [text](https://…) links.
 * No raw HTML, no images (guides use words first). Output is a string of safe HTML.
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(raw: string) {
  return esc(raw)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
}

export function renderMarkdown(src: string): { title: string; html: string } {
  const out: string[] = []
  let title = ''
  let list: 'ul' | 'ol' | null = null
  let para: string[] = []
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const line of src.split('\n')) {
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    const ul = /^-\s+(.*)$/.exec(line)
    const ol = /^\d+\.\s+(.*)$/.exec(line)
    const quote = /^>\s?(.*)$/.exec(line)
    if (h) {
      flushPara()
      closeList()
      const level = (h[1] ?? '#').length
      if (level === 1 && !title) title = h[2] ?? ''
      else out.push(`<h${level}>${inline(h[2] ?? '')}</h${level}>`)
    } else if (ul || ol) {
      flushPara()
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      out.push(`<li>${inline((ul ?? ol)?.[1] ?? '')}</li>`)
    } else if (quote) {
      flushPara()
      closeList()
      out.push(`<aside class="help-note">${inline(quote[1] ?? '')}</aside>`)
    } else if (line.trim() === '') {
      flushPara()
      closeList()
    } else para.push(line.trim())
  }
  flushPara()
  closeList()
  return { title, html: out.join('\n') }
}
