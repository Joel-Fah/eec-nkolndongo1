/**
 * Rich text (decision 0028): what editors write is a small JSON document (the TipTap/ProseMirror shape),
 * never HTML. `cleanDoc` keeps only a fixed set of nodes, marks and attributes, so a hostile or damaged
 * document cannot inject markup; `renderHtml` turns the clean document into escaped HTML on the server, so the
 * public site ships no editor code. Pure functions, no dependency, usable in the API, the Worker and the tests.
 */

export type Mark =
  | { type: 'bold' | 'italic'; attrs?: undefined }
  | { type: 'link'; attrs: { href: string } }
export type Node = {
  type: string
  attrs?: Record<string, string | number>
  content?: Node[]
  text?: string
  marks?: Mark[]
}
export type Doc = { type: 'doc'; content: Node[] }

export const EMPTY_DOC: Doc = { type: 'doc', content: [] }

const MAX_DEPTH = 6
const MAX_NODES = 5000
const MAX_TEXT = 20_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BLOCKS: Record<string, readonly string[]> = {
  doc: [
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'blockquote',
    'image',
    'horizontalRule',
  ],
  paragraph: ['text', 'hardBreak'],
  heading: ['text', 'hardBreak'],
  blockquote: ['paragraph'],
  bulletList: ['listItem'],
  orderedList: ['listItem'],
  listItem: ['paragraph', 'bulletList', 'orderedList'],
  image: [],
  horizontalRule: [],
  hardBreak: [],
}

/** Links: https, mailto, tel, or a path on this site. Anything else (javascript:, data:, //host) is dropped. */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const href = raw.trim()
  if (href.length === 0 || href.length > 2000 || /[\p{Cc}\s]/u.test(href)) return null
  if (/^https:\/\/[^/]/i.test(href)) return href
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return href
  if (/^tel:\+?[0-9]{3,20}$/i.test(href)) return href
  if (/^\/(?!\/)/.test(href)) return href
  return null
}

const safeMediaSrc = (v: unknown) =>
  typeof v === 'string' && /^\/media\/[A-Za-z0-9._/-]{1,300}$/.test(v) && !v.includes('..')
    ? v
    : null

function cleanMarks(marks: unknown): Mark[] | undefined {
  if (!Array.isArray(marks)) return undefined
  const out: Mark[] = []
  for (const m of marks) {
    if (!m || typeof m !== 'object') continue
    const { type, attrs } = m as { type?: unknown; attrs?: { href?: unknown } }
    if (type === 'bold' || type === 'italic') {
      if (!out.some((x) => x.type === type)) out.push({ type })
    } else if (type === 'link') {
      const href = safeHref(attrs?.href)
      if (href && !out.some((x) => x.type === 'link')) out.push({ type: 'link', attrs: { href } })
    }
  }
  return out.length ? out : undefined
}

/** Returns the cleaned node(s). Unknown wrappers are unwrapped (their text survives), unknown leaves dropped. */
function cleanNode(raw: unknown, parent: string, depth: number, budget: { n: number }): Node[] {
  if (!raw || typeof raw !== 'object' || depth > MAX_DEPTH || budget.n-- <= 0) return []
  const n = raw as Node
  const allowed = BLOCKS[parent] ?? []
  if (n.type === 'text') {
    if (!allowed.includes('text') || typeof n.text !== 'string' || n.text === '') return []
    const marks = cleanMarks(n.marks)
    return [{ type: 'text', text: n.text.slice(0, MAX_TEXT), ...(marks ? { marks } : {}) }]
  }
  if (typeof n.type !== 'string' || !Object.hasOwn(BLOCKS, n.type)) {
    // Unknown wrapper: keep what it holds, if the parent accepts it.
    return Array.isArray(n.content)
      ? n.content.flatMap((c) => cleanNode(c, parent, depth + 1, budget))
      : []
  }
  if (!allowed.includes(n.type)) return []
  if (n.type === 'image') {
    const src = safeMediaSrc(n.attrs?.src)
    if (!src) return []
    const attrs: Record<string, string | number> = { src }
    const mediaId = n.attrs?.mediaId
    if (typeof mediaId === 'string' && UUID.test(mediaId)) attrs.mediaId = mediaId
    for (const k of ['alt', 'caption', 'credit'] as const) {
      const v = n.attrs?.[k]
      if (typeof v === 'string' && v.trim()) attrs[k] = v.trim().slice(0, 500)
    }
    for (const k of ['width', 'height'] as const) {
      const v = n.attrs?.[k]
      if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 20000) attrs[k] = v
    }
    return [{ type: 'image', attrs }]
  }
  const node: Node = { type: n.type }
  if (n.type === 'heading') {
    const level = Number(n.attrs?.level)
    node.attrs = { level: level === 3 ? 3 : 2 }
  }
  if (n.type === 'orderedList' && Number.isInteger(n.attrs?.start) && Number(n.attrs?.start) > 1)
    node.attrs = { start: Math.min(Number(n.attrs?.start), 9999) }
  if ((BLOCKS[n.type] ?? []).length) {
    const content = (Array.isArray(n.content) ? n.content : []).flatMap((c) =>
      cleanNode(c, n.type, depth + 1, budget),
    )
    if (
      content.length === 0 &&
      ['bulletList', 'orderedList', 'listItem', 'blockquote'].includes(n.type)
    )
      return []
    if (content.length) node.content = content
  }
  return [node]
}

/** Any input → a safe document. Never throws. */
export function cleanDoc(raw: unknown): Doc {
  const budget = { n: MAX_NODES }
  const content =
    raw && typeof raw === 'object' && Array.isArray((raw as Doc).content)
      ? (raw as Doc).content.flatMap((c) => cleanNode(c, 'doc', 1, budget))
      : []
  return { type: 'doc', content }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function renderText(n: Node) {
  let html = esc(n.text ?? '')
  for (const m of n.marks ?? []) {
    if (m.type === 'bold') html = `<strong>${html}</strong>`
    else if (m.type === 'italic') html = `<em>${html}</em>`
    else if (m.type === 'link') {
      const external = m.attrs.href.startsWith('https://')
      html = `<a href="${esc(m.attrs.href)}"${external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${html}</a>`
    }
  }
  return html
}

function render(n: Node): string {
  const inner = () => (n.content ?? []).map(render).join('')
  switch (n.type) {
    case 'text':
      return renderText(n)
    case 'paragraph':
      return `<p>${inner()}</p>`
    case 'heading':
      return `<h${n.attrs?.level}>${inner()}</h${n.attrs?.level}>`
    case 'blockquote':
      return `<blockquote>${inner()}</blockquote>`
    case 'bulletList':
      return `<ul>${inner()}</ul>`
    case 'orderedList':
      return `<ol${n.attrs?.start ? ` start="${n.attrs.start}"` : ''}>${inner()}</ol>`
    case 'listItem':
      return `<li>${inner()}</li>`
    case 'hardBreak':
      return '<br>'
    case 'horizontalRule':
      return '<hr>'
    case 'image': {
      const a = n.attrs ?? {}
      const dims = a.width && a.height ? ` width="${a.width}" height="${a.height}"` : ''
      const img = `<img src="${esc(String(a.src))}" alt="${esc(String(a.alt ?? ''))}"${dims} loading="lazy" decoding="async">`
      const cap = [a.caption, a.credit].filter(Boolean).map(String).join(' · ')
      return cap
        ? `<figure>${img}<figcaption>${esc(cap)}</figcaption></figure>`
        : `<figure>${img}</figure>`
    }
    default:
      return ''
  }
}

/** Escaped HTML for the public page. Always cleans first: stored documents are trusted no further than input. */
export function renderHtml(doc: unknown): string {
  return cleanDoc(doc).content.map(render).join('')
}

/** Plain text, for excerpts, search and feeds. */
export function plainText(doc: unknown): string {
  const out: string[] = []
  const walk = (n: Node) => {
    if (n.type === 'text') out.push(n.text ?? '')
    else if (n.type === 'hardBreak') out.push(' ')
    else {
      for (const c of n.content ?? []) walk(c)
      if (n.type === 'image' && n.attrs?.alt) out.push(String(n.attrs.alt))
      out.push(' ')
    }
  }
  for (const n of cleanDoc(doc).content) walk(n)
  return out.join('').replace(/\s+/g, ' ').trim()
}

export const isEmptyDoc = (doc: unknown) => cleanDoc(doc).content.length === 0
