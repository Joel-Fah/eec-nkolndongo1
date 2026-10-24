/**
 * Registrations (decision 0035): phone numbers as people type them, age bands, and how long a registration is kept.
 * Pure functions, shared by the form, the API, the admin (which shows the time left) and the retention job.
 */

/** A Cameroon number written with or without the country code, or any international number with its « + ». */
export type Phone = { e164: string; display: string }

/**
 * « 677 12 34 56 », « 6 77 12 34 56 », « +237 677 12 34 56 », « 00237677123456 », « 237677123456 » → the same number.
 * Most people type it WITHOUT the code, so nine digits starting with 6 (mobile) or 2 (landline) are read as Cameroon.
 * Another country needs its « + » (or « 00 »). Anything else → null.
 */
export function normalizePhone(raw: string): Phone | null {
  const s = raw.trim()
  if (!s || /[^\d\s+().-]/.test(s)) return null
  const international = s.startsWith('+') || s.startsWith('00')
  let digits = s.replace(/\D/g, '')
  if (s.startsWith('00')) digits = digits.slice(2)
  if (international || (digits.startsWith('237') && digits.length === 12)) {
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null
    const e164 = `+${digits}`
    return { e164, display: e164.startsWith('+237') ? displayCameroon(e164.slice(4)) : e164 }
  }
  if (digits.length === 9 && /^[62]/.test(digits))
    return { e164: `+237${digits}`, display: displayCameroon(digits) }
  return null
}
const displayCameroon = (n: string) =>
  `+237 ${n.slice(0, 1)} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`

/** A child is recorded by age band only (decision 0035). */
export const AGE_BANDS = ['0-5', '6-9', '10-13', '14-17', 'adult'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

// ——— How long a registration is kept ————————————————————————————
export const REGISTRATION_RETENTION = { monthsAfterEvent: 6, monthsAfterClose: 12 }
const DAY = 86_400_000
const addMonths = (d: Date, n: number) => {
  const r = new Date(d.getTime())
  const day = r.getUTCDate()
  r.setUTCDate(1)
  r.setUTCMonth(r.getUTCMonth() + n)
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate()
  r.setUTCDate(Math.min(day, last))
  return r
}
/**
 * The day personal data of a form's registrations is deleted: 6 months after the event, and in any case 12 months after
 * the form closed (hard cap). Returns a YYYY-MM-DD date.
 */
export function purgeOn(eventDate: string, closesAt?: Date | null): string {
  const base = addMonths(
    new Date(`${eventDate}T00:00:00Z`),
    REGISTRATION_RETENTION.monthsAfterEvent,
  )
  const cap = closesAt ? addMonths(closesAt, REGISTRATION_RETENTION.monthsAfterClose) : null
  const first = cap && cap < base ? cap : base
  return first.toISOString().slice(0, 10)
}
/** Whole days left until the deletion day (0 on the day itself, negative once it has passed). */
export function daysLeft(purge: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((Date.parse(`${purge}T00:00:00Z`) - today) / DAY)
}
export type RetentionLevel = 'calm' | 'warning' | 'critical'
/** Colour of the countdown the admin sees: calm above 60 days, warning from 60 to 15, critical under 15. */
export const retentionLevel = (days: number): RetentionLevel =>
  days < 15 ? 'critical' : days <= 60 ? 'warning' : 'calm'
