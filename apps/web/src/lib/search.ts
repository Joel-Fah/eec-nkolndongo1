import type { Locale } from '@eec/i18n'
import { departmentHref } from './departments-routes'
import { eventHref } from './events-routes'
import { guideHref } from './guides-routes'
import { href, pages } from './nav'
import { newsItemHref } from './news-routes'

export const SEARCH_TYPES = ['news', 'events', 'guides', 'departments', 'pages'] as const
export type SearchType = (typeof SEARCH_TYPES)[number]
export type Hit = { type: SearchType; key: string; title: string; snippet: string }

export const searchHref = (locale: Locale, q = '') => {
  const base = href(locale, pages.find((p) => p.id === 'search')?.path[locale] ?? '')
  return q ? `${base}?q=${encodeURIComponent(q)}` : base
}
export const rightSearchPath = (locale: Locale, pathname: string) => pathname === searchHref(locale)

export function hitHref(locale: Locale, h: Hit) {
  switch (h.type) {
    case 'news':
      return newsItemHref(locale, h.key)
    case 'events':
      return eventHref(locale, h.key)
    case 'guides':
      return guideHref(locale, h.key)
    case 'departments':
      return departmentHref(locale, h.key)
    default:
      return href(locale, h.key)
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const CLASSES: Record<string, string> = {
  a: 'aàáâãäå',
  c: 'cç',
  e: 'eèéêë',
  i: 'iìíîï',
  n: 'nñ',
  o: 'oòóôõö',
  u: 'uùúûü',
  y: 'yýÿ',
}
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Escapes the text, then wraps each searched word in <mark>, ignoring case and accents (« bapteme » finds « baptême »). */
export function highlight(text: string, q: string): string {
  const words = fold(q)
    .split(' ')
    .filter((w) => w.length >= 2)
  let out = esc(text)
  for (const w of words) {
    const pattern = [...w]
      .map((ch) => {
        const set = CLASSES[ch]
        return set ? `[${set}${set.toUpperCase()}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      })
      .join('')
    out = out.replace(new RegExp(`(${pattern})(?![^<]*>)`, 'giu'), '<mark>$1</mark>')
  }
  return out
}

/** Static pages whose name or description contains every searched word. */
export function matchPages(
  q: string,
  entries: { path: string; title: string; text: string }[],
): Hit[] {
  const words = fold(q)
    .split(' ')
    .filter((w) => w.length >= 2)
  if (!words.length) return []
  return entries
    .filter((e) => words.every((w) => fold(`${e.title} ${e.text}`).includes(w)))
    .map((e) => ({ type: 'pages' as const, key: e.path, title: e.title, snippet: e.text }))
}
