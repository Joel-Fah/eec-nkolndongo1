import { createT, isLocale, type Locale, locales } from '@eec/i18n'

export function localeOf(value: string | undefined): Locale {
  if (!isLocale(value)) throw new Error(`Unsupported locale: ${value}`)
  return value
}

/** Translator for the current page: `const t = useT(Astro.currentLocale)`. */
export const useT = (value: string | undefined) => createT(localeOf(value))

export const localePaths = () => locales.map((locale) => ({ params: { locale } }))
