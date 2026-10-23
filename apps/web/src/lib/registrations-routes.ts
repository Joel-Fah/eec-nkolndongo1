import type { Locale } from '@eec/i18n'
import { eventsListHref } from './events-routes'

/** Registrations live under the Agenda's events: /agenda/evenements/inscription/<form> · /calendar/events/register/<form>. */
const word = (locale: Locale) => (locale === 'fr' ? 'inscription' : 'register')
export const registrationHref = (locale: Locale, slug: string) =>
  `${eventsListHref(locale)}${word(locale)}/${slug}/`
export const cancelPath = (locale: Locale) =>
  `${eventsListHref(locale)}${word(locale)}/${locale === 'fr' ? 'annuler' : 'cancel'}/`
export const cancelHref = (locale: Locale, token: string) =>
  `${cancelPath(locale)}?t=${encodeURIComponent(token)}`
export const rightRegistrationPath = (locale: Locale, pathname: string) =>
  pathname.startsWith(`/${locale}/`) &&
  pathname.startsWith(`${eventsListHref(locale)}${word(locale)}/`)
