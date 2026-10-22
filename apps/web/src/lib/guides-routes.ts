import type { Locale } from '@eec/i18n'
import { href, pages } from './nav'

export const guidesBase = (locale: Locale) =>
  pages.find((p) => p.id === 'pratique')?.path[locale] ?? ''
export const guidesHref = (locale: Locale) => href(locale, guidesBase(locale))
export const guideHref = (locale: Locale, slug: string) =>
  `${href(locale, guidesBase(locale))}${slug}/`
export const rightGuidesPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/${guidesBase(locale)}`)
/** Where « Poser une question » leads: the contact form on « Nous trouver », with the guide as the subject. */
export const askHref = (locale: Locale, subject = '') =>
  `${href(locale, pages.find((p) => p.id === 'trouver')?.path[locale] ?? '')}${subject ? `?sujet=${encodeURIComponent(subject.slice(0, 120))}&categorie=vie_pratique` : ''}#contact`
