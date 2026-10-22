import type { Locale } from '@eec/i18n'
import { departmentHref } from './departments-routes'
import { eventHref } from './events-routes'
import { fold, fuzzyHas } from './fuzzy'
import { guideHref } from './guides-routes'
import { href, pages } from './nav'
import { newsItemHref } from './news-routes'
import { sermonHref } from './sermons-routes'

export const SEARCH_TYPES = ['news', 'events', 'sermons', 'guides', 'departments', 'pages'] as const
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
    case 'sermons':
      return sermonHref(locale, h.key)
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

/** Static pages whose name or description contains every searched word (forgiving typos). */
export function matchPages(
  q: string,
  entries: { path: string; title: string; text: string }[],
): Hit[] {
  const words = fold(q)
    .split(' ')
    .filter((w) => w.length >= 2)
  if (!words.length) return []
  return entries
    .filter((e) => words.every((w) => fuzzyHas(`${e.title} ${e.text}`, w)))
    .map((e) => ({ type: 'pages' as const, key: e.path, title: e.title, snippet: e.text }))
}

export type QuickAction = {
  id: string
  icon: 'clock' | 'church' | 'calendar' | 'department' | 'checklist' | 'location' | 'chat' | 'gift'
  label: string
  href: string
}
/** Where people most often want to go: a short list of direct actions, shown with the hints and after results. */
export function quickActions(locale: Locale, label: (id: string) => string): QuickAction[] {
  const path = (id: string) => href(locale, pages.find((p) => p.id === id)?.path[locale] ?? '')
  return [
    { id: 'cultes', icon: 'clock', label: label('act_cultes'), href: path('cultes') },
    { id: 'dimanche', icon: 'church', label: label('act_dimanche'), href: path('dimanche') },
    {
      id: 'evenements',
      icon: 'calendar',
      label: label('act_evenements'),
      href: path('evenements'),
    },
    {
      id: 'departements',
      icon: 'department',
      label: label('act_departements'),
      href: path('departements'),
    },
    { id: 'pratique', icon: 'checklist', label: label('act_pratique'), href: path('pratique') },
    { id: 'trouver', icon: 'location', label: label('act_trouver'), href: path('trouver') },
    { id: 'write', icon: 'chat', label: label('act_write'), href: `${path('trouver')}#contact` },
    { id: 'give', icon: 'gift', label: label('act_give'), href: path('give') },
  ]
}

/** The static pages as search entries (title, description, address), for the results page and the header dialog. */
export function pageEntries(
  locale: Locale,
  label: (id: string) => string,
  desc: (id: string) => string,
  lead: (id: string) => string,
) {
  return pages
    .filter((p) => !['account', 'search', 'privacy', 'legal', 'credits'].includes(p.id))
    .map((p) => ({
      path: p.path[locale],
      title: label(p.id),
      text: `${desc(p.id)} ${lead(p.id)}`.trim(),
    }))
}
