import type { Locale } from './locales.ts'
import { m } from './paraglide/messages.js'
import { frTypo } from './typography.ts'

type Messages = typeof m
export type MessageKey = keyof Messages
type Inputs<K extends MessageKey> = NonNullable<Parameters<Messages[K]>[0]>
type Args<K extends MessageKey> =
  Record<string, never> extends Inputs<K> ? [inputs?: Inputs<K>] : [inputs: Inputs<K>]

export type Translate = <K extends MessageKey>(key: K, ...args: Args<K>) => string

/**
 * Returns a translator bound to one locale. French output gets correct typography (`frTypo`), so
 * messages can be written with plain spaces: `"Bienvenue !"`.
 *
 * Astro: `const t = createT(Astro.currentLocale)` — explicit locale, no global state at build time.
 */
export function createT(locale: Locale): Translate {
  return (key, ...[inputs]) => {
    const message = m[key] as (inputs: unknown, options: { locale: Locale }) => string
    const text = message(inputs ?? {}, { locale })
    return locale === 'fr' ? frTypo(text) : text
  }
}
