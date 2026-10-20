/**
 * What the sign-in screen shows beside the photo: a verse or a testimonial, drawn at random.
 * Verses are in the versions chosen for being easy to read: Parole de Vie (French), Easy-to-Read Version
 * (English). The version is always named next to the reference. To do: check the wording against the licensed
 * text and the publishers' quotation terms, and let members choose their version. Testimonials are real words from real people: NEVER invent one. An entry
 * counts only when `validated` is true (the person agreed and the content partner approved it); until
 * then the screen shows verses only.
 */
import type { MessageKey } from '@eec/i18n'

export type Quote =
  | { kind: 'verse'; text: MessageKey; cite: MessageKey }
  | {
      kind: 'testimonial'
      text: { fr: string; en: string }
      name: string
      role: { fr: string; en: string }
    }

export const verses: Quote[] = (['v1', 'v2', 'v3', 'v4'] as const).map((k) => ({
  kind: 'verse',
  text: `auth.quotes.${k}` as MessageKey,
  cite: `auth.quotes.${k}_cite` as MessageKey,
}))

export type Testimonial = Extract<Quote, { kind: 'testimonial' }> & { validated: boolean }
export const testimonials: Testimonial[] = []

/** Alternates kinds: a coin flip between a verse and a validated testimonial (verses only when there is none). */
export function pickQuote(): Quote {
  const real = testimonials.filter((x) => x.validated)
  const pool = real.length && Math.random() < 0.5 ? real : verses
  return pool[Math.floor(Math.random() * pool.length)] as Quote
}
