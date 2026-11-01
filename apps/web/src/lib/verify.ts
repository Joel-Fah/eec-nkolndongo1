import type { Locale } from '@eec/i18n'

/** Where the QR code of a Communion card leads: /verifier/?t=<signed token> · /verify/?t=<signed token>. */
export const verifyHref = (locale: Locale) =>
  `/${locale}/${locale === 'fr' ? 'verifier' : 'verify'}/`
export const rightVerifyPath = (locale: Locale, pathname: string) => pathname === verifyHref(locale)
