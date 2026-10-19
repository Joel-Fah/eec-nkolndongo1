export const locales = ['fr', 'en'] as const
export type Locale = (typeof locales)[number]
export const baseLocale: Locale = 'fr'

/** BCP 47 tags used for Intl formatting (Cameroon French, British English). */
export const intlLocale: Record<Locale, string> = { fr: 'fr-CM', en: 'en-GB' }

export const timeZone = 'Africa/Douala'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

/**
 * Picks the best supported locale from an `Accept-Language` header.
 * Falls back to French (the parish's first language).
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return baseLocale
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1, index }
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0]
    if (isLocale(primary)) return primary
  }
  return baseLocale
}
