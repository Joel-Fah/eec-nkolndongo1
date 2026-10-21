import type { Locale } from '@eec/i18n'
import { href, pages } from './nav'

/** Where the news list lives in each language (from the navigation: actualites/nouvelles · news/latest). */
export const newsBase = (locale: Locale) =>
  pages.find((p) => p.id === 'nouvelles')?.path[locale] ?? ''
export const newsListHref = (locale: Locale) => href(locale, newsBase(locale))
export const newsItemHref = (locale: Locale, slug: string) =>
  `${href(locale, newsBase(locale))}${slug}/`
/** `/en/actualites/nouvelles/` is not an English address: the page exists only under its own language's path. */
export const rightPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/${newsBase(locale)}`)
