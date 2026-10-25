import type { Locale } from '@eec/i18n'
import { href, pages } from './nav'

/** Where the sermons live in each language (from the navigation: actualites/predications · news/sermons). */
export const sermonsBase = (locale: Locale) =>
  pages.find((p) => p.id === 'predications')?.path[locale] ?? ''
export const sermonsListHref = (locale: Locale) => href(locale, sermonsBase(locale))
export const sermonHref = (locale: Locale, slug: string) =>
  `${href(locale, sermonsBase(locale))}${slug}/`
export const rightSermonsPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/${sermonsBase(locale)}`)
