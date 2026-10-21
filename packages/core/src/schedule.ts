/**
 * The weekly rhythm of the parish (services, studies, prayer, office hours) and « what is next ». Pure functions,
 * all in the parish's time zone (Africa/Douala). Only validated slots are ever passed in by the callers.
 */
import { localParts, zonedToUtc } from './recurrence.ts'

export const SLOT_KINDS = [
  'culte',
  'culte_enfants',
  'etude_biblique',
  'priere',
  'repetition',
  'permanence',
  'autre',
] as const
export type SlotKind = (typeof SLOT_KINDS)[number]

export type Slot = {
  id: string
  kind: SlotKind
  labelFr: string
  labelEn: string
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  /** Local 24 h times, `HH:MM`. */
  start: string
  end: string | null
  placeFr?: string
  placeEn?: string
}

export type SlotException = {
  id?: string
  /** Local date YYYY-MM-DD. */
  date: string
  /** The slot concerned; null for « every service that day ». */
  slotId: string | null
  kind: 'cancelled' | 'changed' | 'extra'
  noteFr?: string
  noteEn?: string
  /** `changed`: the new times. `extra`: the extra gathering (needs `labelFr`). */
  start?: string
  end?: string | null
  labelFr?: string
  labelEn?: string
}

export type ServiceInstance = {
  slot: Slot
  date: string
  startsAt: Date
  endsAt: Date | null
  cancelled: boolean
  changed: boolean
  extra: boolean
  noteFr?: string
  noteEn?: string
}

export const PARISH_TZ = 'Africa/Douala'

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number) as [number, number]
  return { h, m }
}
const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const x = new Date(Date.UTC(y, m - 1, d + n))
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`
}
export const localDate = (d: Date, tz = PARISH_TZ) => {
  const p = localParts(d, tz)
  return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}
const at = (date: string, time: string, tz: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const { h, m: mm } = parseTime(time)
  return zonedToUtc(y, m, d, h, mm, tz)
}

/** Every service in the `days` days from `from` (local date), exceptions applied, cancelled ones flagged. */
export function upcomingServices(
  slots: Slot[],
  exceptions: SlotException[],
  from: Date,
  days: number,
  tz = PARISH_TZ,
): ServiceInstance[] {
  const out: ServiceInstance[] = []
  const first = localDate(from, tz)
  for (let i = 0; i < days; i++) {
    const date = addDays(first, i)
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    const dayExc = exceptions.filter((e) => e.date === date)
    for (const slot of slots.filter((s) => s.weekday === weekday)) {
      const exc = dayExc.find(
        (e) => (e.slotId === slot.id || e.slotId === null) && e.kind !== 'extra',
      )
      const start = exc?.kind === 'changed' && exc.start ? exc.start : slot.start
      const end = exc?.kind === 'changed' ? (exc.end ?? null) : slot.end
      out.push({
        slot,
        date,
        startsAt: at(date, start, tz),
        endsAt: end ? at(date, end, tz) : null,
        cancelled: exc?.kind === 'cancelled',
        changed: exc?.kind === 'changed',
        extra: false,
        noteFr: exc?.noteFr,
        noteEn: exc?.noteEn,
      })
    }
    for (const e of dayExc.filter((x) => x.kind === 'extra' && x.start && x.labelFr)) {
      out.push({
        slot: {
          id: e.id ?? `extra-${date}`,
          kind: 'autre',
          labelFr: e.labelFr as string,
          labelEn: e.labelEn || (e.labelFr as string),
          weekday,
          start: e.start as string,
          end: e.end ?? null,
        },
        date,
        startsAt: at(date, e.start as string, tz),
        endsAt: e.end ? at(date, e.end, tz) : null,
        cancelled: false,
        changed: false,
        extra: true,
        noteFr: e.noteFr,
        noteEn: e.noteEn,
      })
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

export type NextService = ServiceInstance & { when: 'now' | 'today' | 'tomorrow' | 'later' }

/** The next (or current) service of the given kinds that is not cancelled, within 14 days. */
export function nextService(
  slots: Slot[],
  exceptions: SlotException[],
  now: Date,
  opts: { kinds?: SlotKind[]; tz?: string } = {},
): NextService | null {
  const tz = opts.tz ?? PARISH_TZ
  const kinds = opts.kinds ?? ['culte']
  const found = upcomingServices(
    slots.filter((s) => kinds.includes(s.kind)),
    exceptions,
    now,
    15,
    tz,
  ).find((s) => !s.cancelled && (s.endsAt ?? new Date(s.startsAt.getTime() + 2 * 3_600_000)) > now)
  if (!found) return null
  const today = localDate(now, tz)
  const when =
    found.startsAt <= now
      ? 'now'
      : found.date === today
        ? 'today'
        : found.date === addDays(today, 1)
          ? 'tomorrow'
          : 'later'
  return { ...found, when }
}

/** Validates what an editor typed: `HH:MM`, a real weekday, end after start. */
export function slotProblems(s: { weekday: number; start: string; end: string | null }): string[] {
  const out: string[] = []
  const ok = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
  if (!Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6) out.push('weekday')
  if (!ok(s.start)) out.push('start')
  if (s.end !== null && (!ok(s.end) || s.end <= s.start)) out.push('end')
  return out
}
