import type { Locale } from '@eec/i18n'
import { href, pages } from './nav'

export const guidesBase = (locale: Locale) =>
  pages.find((p) => p.id === 'pratique')?.path[locale] ?? ''
export const guidesHref = (locale: Locale) => href(locale, guidesBase(locale))
export const guideHref = (locale: Locale, slug: string) =>
  `${href(locale, guidesBase(locale))}${slug}/`
export const rightGuidesPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/${guidesBase(locale)}`)
/** Where « Poser une question » leads. Until the contact form exists (Phase 03 §10) it is the « Nous trouver » page. */
export const askHref = (locale: Locale) =>
  href(locale, pages.find((p) => p.id === 'trouver')?.path[locale] ?? '')
