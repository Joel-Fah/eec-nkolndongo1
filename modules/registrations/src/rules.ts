/**
 * The rules of a registration form, as pure functions: is it open, does a party fit, are the answers acceptable, the code and
 * the cancel-link lifetime, and CSV cells that cannot run as formulas. The API and the admin both use them.
 */
import type { FormField } from './schema.ts'

export type Availability = 'draft' | 'not_yet' | 'open' | 'full' | 'closed'
type FormTimes = {
  state: string
  opensAt: Date | null
  closesAt: Date | null
  capacity: number | null
  waitlist: boolean
  eventDate: string
}
const DAY = 86_400_000

/**
 * What a visitor can do with the form right now. « full » only when there is no waitlist; with one, a form at capacity stays
 * « open » (the person lands on the waitlist). The event's own day closes it, whatever the dates say.
 */
export function availability(f: FormTimes, taken: number, now = new Date()): Availability {
  if (f.state !== 'published') return 'draft'
  if (f.opensAt && now < f.opensAt) return 'not_yet'
  const endOfEvent = Date.parse(`${f.eventDate}T23:59:59Z`)
  if ((f.closesAt && now > f.closesAt) || now.getTime() > endOfEvent + DAY) return 'closed'
  if (!f.waitlist && f.capacity != null && taken >= f.capacity) return 'full'
  return 'open'
}

/** confirmed if the party fits in the places left, otherwise waitlist (or null when there is no waitlist). */
export function placeFor(
  capacity: number | null,
  taken: number,
  party: number,
  waitlist: boolean,
): 'confirmed' | 'waitlist' | null {
  if (capacity == null || taken + party <= capacity) return 'confirmed'
  return waitlist ? 'waitlist' : null
}

export const spotsLeft = (capacity: number | null, taken: number) =>
  capacity == null ? null : Math.max(capacity - taken, 0)

/** Seconds a cancel link lives: until the day after the event, and at least a day. */
export function cancelLinkSeconds(eventDate: string, now = new Date()): number {
  const until = Date.parse(`${eventDate}T00:00:00Z`) + 2 * DAY
  return Math.max(Math.round((until - now.getTime()) / 1000), DAY / 1000)
}

// ——— Answers to the extra questions ——————————————————————————————
export type Answers = Record<string, string | string[] | boolean>
export type AnswerProblem = { field: string; code: 'required' | 'invalid' }

/** Keeps only the answers the form asks for, trimmed; reports what is missing or not one of the choices. */
export function checkAnswers(
  fields: FormField[],
  raw: Record<string, unknown>,
): { answers: Answers; problems: AnswerProblem[] } {
  const answers: Answers = {}
  const problems: AnswerProblem[] = []
  for (const f of fields) {
    const v = raw[f.id]
    const empty =
      v == null ||
      v === '' ||
      (Array.isArray(v) && v.length === 0) ||
      (f.kind === 'yesno' && v === undefined)
    if (empty) {
      if (f.required && f.kind !== 'yesno') problems.push({ field: f.id, code: 'required' })
      if (f.kind === 'yesno' && f.required && v === undefined)
        problems.push({ field: f.id, code: 'required' })
      continue
    }
    const choices = f.options.map((o) => o.fr)
    if (f.kind === 'yesno') {
      if (typeof v !== 'boolean') problems.push({ field: f.id, code: 'invalid' })
      else answers[f.id] = v
    } else if (f.kind === 'choice') {
      if (typeof v !== 'string' || !choices.includes(v))
        problems.push({ field: f.id, code: 'invalid' })
      else answers[f.id] = v
    } else if (f.kind === 'multi') {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !choices.includes(x)))
        problems.push({ field: f.id, code: 'invalid' })
      else answers[f.id] = [...new Set(v as string[])]
    } else if (typeof v !== 'string' || v.trim().length > (f.kind === 'group' ? 80 : 300))
      problems.push({ field: f.id, code: 'invalid' })
    else answers[f.id] = v.trim()
  }
  return { answers, problems }
}

// ——— Codes and CSV ————————————————————————————————————————————————
/** Six characters without the ones that look alike (no 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newCode(
  random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
) {
  return [...random(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** A CSV cell: quoted, and a leading = + - @ (or tab / CR) is defused so a spreadsheet never runs it as a formula. */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * The builder offers no « sensitive » question (decision 0035). A label that asks for health, origin, religion beyond the
 * context, political views or money is refused, in the form editor and again by the API.
 */
const SENSITIVE =
  /sant[eé]|maladie|handicap|allerg|m[eé]dica|enceinte|vih|sida|religion|confession|ethni|tribu|origine|politi|vote|salaire|revenu|argent|health|disease|disabilit|allerg|medic|pregnan|hiv|ethnic|tribe|origin|politic|salary|income|money/i
export const looksSensitive = (label: string) => SENSITIVE.test(label)
