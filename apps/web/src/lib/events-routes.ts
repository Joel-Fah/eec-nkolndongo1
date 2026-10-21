import type { Locale } from '@eec/i18n'
import { href, pages } from './nav'

export const eventsBase = (locale: Locale) =>
  pages.find((p) => p.id === 'evenements')?.path[locale] ?? ''
export const eventsListHref = (locale: Locale) => href(locale, eventsBase(locale))
export const eventHref = (locale: Locale, slug: string) =>
  `${href(locale, eventsBase(locale))}${slug}/`
export const rightEventsPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/${eventsBase(locale)}`)
/** The subscribable calendar (RFC 5545), proxied from the API. */
export const feedHref = (locale: Locale, group?: string | null) =>
  `/${locale}/${locale === 'fr' ? 'agenda/calendrier.ics' : 'calendar/feed.ics'}${group ? `?groupe=${group}` : ''}`

export const TZ = 'Africa/Douala'

/** Intl formatters are slow to build (≈ 0.2 ms each); a list of 25 cards must not build 100. Cached per options. */
const formatters = new Map<string, Intl.DateTimeFormat>()
export const fmt = (locale: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options)
    formatters.set(key, f)
  }
  return f
}
/** Local (Douala) calendar day of an instant, as YYYY-MM-DD. */
export const dayKey = (d: Date | string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
export const timeText = (iso: string, locale: Locale, allDay: boolean, allDayLabel: string) =>
  allDay
    ? allDayLabel
    : new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(
        new Date(iso),
      )
export const dayText = (
  iso: string,
  locale: Locale,
  allDay: boolean,
  style: 'full' | 'long' | 'short' = 'full',
) =>
  new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: allDay ? 'UTC' : TZ }).format(
    new Date(iso),
  )
