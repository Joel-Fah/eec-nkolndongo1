import type { Locale } from '@eec/i18n'
import { href, pages } from './nav'

export const departmentsBase = (locale: Locale) =>
  pages.find((p) => p.id === 'departements')?.path[locale] ?? ''
export const departmentsHref = (locale: Locale) => href(locale, departmentsBase(locale))
export const departmentHref = (locale: Locale, key: string) =>
  `${href(locale, departmentsBase(locale))}${key}/`
export const rightDepartmentsPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/${departmentsBase(locale)}`)
