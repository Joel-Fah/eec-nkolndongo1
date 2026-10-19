import { intlLocale, type Locale, timeZone } from './locales.ts'

const NBSP = ' '

/** `dimanche 25 octobre` / `Sunday 25 October` */
export function formatDate(
  date: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { timeZone, ...options }).format(date)
}

/** 24-hour clock: `09h00` in French, `09:00` in English. */
export function formatTime(date: Date, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return locale === 'fr' ? `${hour}h${minute}` : `${hour}:${minute}`
}

/** CFA francs (XAF, no decimals): `5 000 FCFA` / `5,000 FCFA`. */
export function formatXAF(amount: number, locale: Locale): string {
  const number = new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 0 }).format(
    amount,
  )
  return `${number}${NBSP}FCFA`
}

/** File sizes: `34,1 Ko` / `34.1 KB` (1 KB = 1024 bytes). */
export function formatBytes(bytes: number, locale: Locale): string {
  const kb = bytes / 1024
  const number = new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 1 }).format(kb)
  return `${number}${NBSP}${locale === 'fr' ? 'Ko' : 'KB'}`
}
