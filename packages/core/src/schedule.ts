/**
 * The weekly rhythm of the parish (services, studies, prayer, office hours) and « what is next ». Pure functions,
 * all in the parish's time zone (Africa/Douala). Only validated slots are ever passed in by the callers.
 */
import { localParts, nthWeekdayOfMonth, type Weekday, zonedToUtc } from './recurrence.ts'

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

/** How often a slot happens: every week (or every N weeks), or on given Sundays/weekdays of the month (« the 2nd »). */
export type SlotRecurrence =
  | { freq: 'weekly'; interval?: number }
  | { freq: 'monthly'; nth: number[] }

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
  /** null/absent: every week. */
  recurrence?: SlotRecurrence | null
  /** A slot that follows another one (the preparation, 4 days before the Holy Supper): it moves with it. */
  anchorId?: string | null
  offsetDays?: number
}

export type SlotException = {
  id?: string
  /** Local date YYYY-MM-DD. */
  date: string
  /** The slot concerned; null for « every service that day ». */
  slotId: string | null
  kind: 'cancelled' | 'changed' | 'extra' | 'moved'
  noteFr?: string
  noteEn?: string
  /** `moved`: the new local date (and optionally new times). */
  toDate?: string
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
  /** Happening on another day than usual (and the original day). */
  moved: boolean
  fromDate?: string
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

const weekIndex = (date: string) =>
  Math.floor((Date.parse(`${date}T00:00:00Z`) / 86_400_000 + 3) / 7) // Monday-based weeks since 1970

/** Does the slot's own rhythm put an occurrence on this local date? */
function happensOn(slot: Slot, date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`)
  if (d.getUTCDay() !== slot.weekday) return false
  const r = slot.recurrence
  if (!r || r.freq === 'weekly')
    return !r?.interval || r.interval <= 1 || weekIndex(date) % r.interval === 0
  const [y, m, day] = date.split('-').map(Number) as [number, number, number]
  return r.nth.some((n) => nthWeekdayOfMonth(y, m, n as 1, slot.weekday as Weekday) === day)
}

type Base = {
  slot: Slot
  date: string
  start: string
  end: string | null
  cancelled: boolean
  changed: boolean
  moved: boolean
  fromDate?: string
  noteFr?: string
  noteEn?: string
}

/** The occurrences of a slot with its own rhythm, exceptions applied (moved ones land on their new date). */
function ownInstances(slot: Slot, exceptions: SlotException[], from: string, to: string): Base[] {
  const out: Base[] = []
  // Look a little outside the window: an occurrence can be moved into it from just before or after.
  for (const date of daysFrom(addDays(from, -14), 14 + daysCount(from, to) + 28)) {
    if (!happensOn(slot, date)) continue
    const exc = exceptions.find(
      (e) => e.date === date && (e.slotId === slot.id || e.slotId === null) && e.kind !== 'extra',
    )
    let inst: Base = {
      slot,
      date,
      start: slot.start,
      end: slot.end,
      cancelled: false,
      changed: false,
      moved: false,
    }
    if (exc?.kind === 'cancelled')
      inst = { ...inst, cancelled: true, noteFr: exc.noteFr, noteEn: exc.noteEn }
    else if (exc?.kind === 'changed' && exc.start)
      inst = {
        ...inst,
        start: exc.start,
        end: exc.end ?? null,
        changed: true,
        noteFr: exc.noteFr,
        noteEn: exc.noteEn,
      }
    else if (exc?.kind === 'moved' && exc.toDate)
      inst = {
        ...inst,
        date: exc.toDate,
        fromDate: date,
        start: exc.start ?? slot.start,
        end: exc.start ? (exc.end ?? null) : slot.end,
        moved: true,
        noteFr: exc.noteFr,
        noteEn: exc.noteEn,
      }
    if (inst.date >= from && inst.date <= to) out.push(inst)
  }
  return out
}
const daysCount = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
const daysFrom = (first: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(first, i))

/** Every service in the `days` days from `from` (local date), exceptions applied, cancelled ones flagged. */
export function upcomingServices(
  slots: Slot[],
  exceptions: SlotException[],
  from: Date,
  days: number,
  tz = PARISH_TZ,
): ServiceInstance[] {
  const first = localDate(from, tz)
  const last = addDays(first, days - 1)
  const out: ServiceInstance[] = []
  const push = (b: Base) =>
    out.push({
      slot: b.slot,
      date: b.date,
      startsAt: at(b.date, b.start, tz),
      endsAt: b.end ? at(b.date, b.end, tz) : null,
      cancelled: b.cancelled,
      changed: b.changed,
      extra: false,
      moved: b.moved,
      fromDate: b.fromDate,
      noteFr: b.noteFr,
      noteEn: b.noteEn,
    })
  const byId = new Map(slots.map((s) => [s.id, s]))
  for (const slot of slots) {
    if (slot.anchorId && byId.has(slot.anchorId)) {
      // Follows its anchor: the same moves and cancellations apply, shifted by the offset.
      const anchor = byId.get(slot.anchorId) as Slot
      for (const a of ownInstances(
        { ...anchor, anchorId: null },
        exceptions,
        addDays(first, -(slot.offsetDays ?? 0) - 7),
        addDays(last, -(slot.offsetDays ?? 0) + 7),
      )) {
        const date = addDays(a.date, slot.offsetDays ?? 0)
        if (date < first || date > last) continue
        push({
          slot,
          date,
          start: slot.start,
          end: slot.end,
          cancelled: a.cancelled,
          changed: false,
          moved: a.moved,
          fromDate: a.fromDate ? addDays(a.fromDate, slot.offsetDays ?? 0) : undefined,
          noteFr: a.noteFr,
          noteEn: a.noteEn,
        })
      }
      continue
    }
    for (const inst of ownInstances(slot, exceptions, first, last)) push(inst)
  }
  for (const e of exceptions.filter(
    (x) => x.kind === 'extra' && x.start && x.labelFr && x.date >= first && x.date <= last,
  )) {
    const weekday = new Date(`${e.date}T00:00:00Z`).getUTCDay()
    out.push({
      slot: {
        id: e.id ?? `extra-${e.date}`,
        kind: 'autre',
        labelFr: e.labelFr as string,
        labelEn: e.labelEn || (e.labelFr as string),
        weekday,
        start: e.start as string,
        end: e.end ?? null,
      },
      date: e.date,
      startsAt: at(e.date, e.start as string, tz),
      endsAt: e.end ? at(e.date, e.end, tz) : null,
      cancelled: false,
      changed: false,
      extra: true,
      moved: false,
      noteFr: e.noteFr,
      noteEn: e.noteEn,
    })
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
    45,
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
