import type { Locale } from '@eec/i18n'
import { href, pages } from './nav'

export const meditationsBase = (locale: Locale) =>
  pages.find((p) => p.id === 'meditations')?.path[locale] ?? ''
export const meditationsHref = (locale: Locale, day?: string) =>
  `${href(locale, meditationsBase(locale))}${day ? `?jour=${day}` : ''}`
export const bulletinHref = (locale: Locale, week?: string) =>
  `${href(locale, meditationsBase(locale))}bulletin/${week ? `${week}/` : ''}`
export const rightMeditationsPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/${meditationsBase(locale)}`)
