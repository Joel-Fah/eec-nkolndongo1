/**
 * Events that repeat (decision 0029): a small structured subset instead of free RRULE text, expanded on the server
 * for a requested window. Weekly (chosen weekdays, every N weeks), monthly on the Nth weekday (« 1er dimanche »,
 * « dernier samedi »), or monthly on a day number; ended by a date or a count. Exceptions cancel or move one
 * occurrence. All arithmetic is in the event's own time zone (Africa/Douala has no DST, but nothing here assumes it).
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday (as Date.getUTCDay)

type Ends = { until?: string | null; count?: number | null } // until: local date YYYY-MM-DD, inclusive

export type Recurrence = Ends &
  (
    | { freq: 'weekly'; byDay: Weekday[]; interval?: number }
    | {
        freq: 'monthly'
        mode: 'nthWeekday'
        nth: 1 | 2 | 3 | 4 | -1
        weekday: Weekday
        interval?: number
      }
    | { freq: 'monthly'; mode: 'monthday'; day: number; interval?: number }
  )

export type Exception = {
  /** The occurrence's original local date (YYYY-MM-DD). */
  date: string
  kind: 'cancelled' | 'moved'
  /** Shown publicly next to a cancelled or moved occurrence. */
  noteFr?: string
  noteEn?: string
  /** For `moved`: the new start and end (ISO instants). */
  startsAt?: string
  endsAt?: string | null
}

export type Schedulable = {
  startsAt: Date
  endsAt: Date | null
  allDay: boolean
  timezone: string
  recurrence: Recurrence | null
  exceptions: Exception[]
}

export type Occurrence = {
  /** Original local date: the key used by exceptions. */
  date: string
  startsAt: Date
  endsAt: Date | null
  cancelled: boolean
  moved: boolean
  noteFr?: string
  noteEn?: string
}

export const MAX_WINDOW_DAYS = 550 // ≈ 18 months
const DAY = 86_400_000

/** Calendar parts of an instant in a time zone. */
export function localParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    hh: get('hour'),
    mm: get('minute'),
    ss: get('second'),
  }
}

/** Offset of a zone from UTC at an instant, in minutes (Douala: +60). */
export function offsetMinutes(d: Date, timeZone: string) {
  const p = localParts(d, timeZone)
  return Math.round(
    (Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(d.getTime() / 1000) * 1000) /
      60_000,
  )
}

/** The instant for a local wall-clock time in a zone. */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string,
) {
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let t = guess - offsetMinutes(new Date(guess), timeZone) * 60_000
  t = guess - offsetMinutes(new Date(t), timeZone) * 60_000
  return new Date(t)
}

export const isoDate = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  return { y, m, d }
}
const weekdayOf = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** The day number of the nth (or last, nth = -1) given weekday of a month. */
export function nthWeekdayOfMonth(y: number, m: number, nth: 1 | 2 | 3 | 4 | -1, weekday: Weekday) {
  if (nth === -1) {
    const last = daysInMonth(y, m)
    return last - ((weekdayOf(y, m, last) - weekday + 7) % 7)
  }
  const first = 1 + ((weekday - weekdayOf(y, m, 1) + 7) % 7)
  return first + (nth - 1) * 7
}

/** Local dates of the series, in order, from the first occurrence on (before exceptions and the window). */
function* seriesDates(
  start: { y: number; m: number; d: number },
  r: Recurrence,
  hardStop: string,
): Generator<string> {
  const interval = Math.max(1, r.interval ?? 1)
  if (r.freq === 'weekly') {
    const days = [...new Set(r.byDay)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    const base = Date.UTC(start.y, start.m - 1, start.d)
    // Monday-based week of the start, so « every 2 weeks » is stable.
    const startDow = (new Date(base).getUTCDay() + 6) % 7
    const weekStart = base - startDow * DAY
    for (let w = 0; ; w += interval) {
      for (const wd of days) {
        const t = weekStart + w * 7 * DAY + ((wd + 6) % 7) * DAY
        if (t < base) continue
        const x = new Date(t)
        const date = isoDate(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate())
        if (date > hardStop) return
        yield date
      }
      if (weekStart + w * 7 * DAY > Date.parse(`${hardStop}T00:00:00Z`)) return
    }
  }
  for (let i = 0; ; i += interval) {
    const mIndex = start.m - 1 + i
    const y = start.y + Math.floor(mIndex / 12)
    const m = (mIndex % 12) + 1
    const d = r.mode === 'nthWeekday' ? nthWeekdayOfMonth(y, m, r.nth, r.weekday) : r.day
    if (d > daysInMonth(y, m) || d < 1) {
      if (isoDate(y, m, 1) > hardStop) return
      continue // « the 31st » skips short months
    }
    const date = isoDate(y, m, d)
    if (date > hardStop) return
    if (date >= isoDate(start.y, start.m, start.d)) yield date
  }
}

/**
 * Occurrences whose start falls in [from, to). A single event yields itself. Cancelled occurrences are
 * returned (flagged) so the public page can show them struck through; moved ones carry their new time.
 */
export function expandOccurrences(ev: Schedulable, from: Date, to: Date): Occurrence[] {
  const tz = ev.timezone
  const span = Math.min(to.getTime() - from.getTime(), MAX_WINDOW_DAYS * DAY)
  const end = new Date(from.getTime() + Math.max(0, span))
  const s = localParts(ev.startsAt, tz)
  const duration = ev.endsAt ? ev.endsAt.getTime() - ev.startsAt.getTime() : null
  const exc = new Map(ev.exceptions.map((e) => [e.date, e]))
  const make = (date: string): Occurrence => {
    const { y, m, d } = parseDate(date)
    const startsAt = ev.allDay
      ? new Date(Date.UTC(y, m - 1, d))
      : zonedToUtc(y, m, d, s.hh, s.mm, tz)
    const e = exc.get(date)
    if (e?.kind === 'moved' && e.startsAt)
      return {
        date,
        startsAt: new Date(e.startsAt),
        endsAt: e.endsAt
          ? new Date(e.endsAt)
          : duration === null
            ? null
            : new Date(new Date(e.startsAt).getTime() + duration),
        cancelled: false,
        moved: true,
        noteFr: e.noteFr,
        noteEn: e.noteEn,
      }
    return {
      date,
      startsAt,
      endsAt: duration === null ? null : new Date(startsAt.getTime() + duration),
      cancelled: e?.kind === 'cancelled',
      moved: false,
      noteFr: e?.noteFr,
      noteEn: e?.noteEn,
    }
  }
  const inWindow = (o: Occurrence) => o.startsAt >= from && o.startsAt < end
  const startDate = isoDate(s.y, s.m, s.d)
  if (!ev.recurrence) {
    const o = make(startDate)
    return inWindow(o) ? [o] : []
  }
  const r = ev.recurrence
  // Never look past the window (plus a day for time-zone edges), nor past `until`.
  const windowEnd = localParts(new Date(end.getTime() + DAY), tz)
  let hardStop = isoDate(windowEnd.y, windowEnd.m, windowEnd.d)
  if (r.until && r.until < hardStop) hardStop = r.until
  const out: Occurrence[] = []
  let n = 0
  for (const date of seriesDates({ y: s.y, m: s.m, d: s.d }, r, hardStop)) {
    n++
    if (r.count && n > r.count) break
    const o = make(date)
    if (inWindow(o)) out.push(o)
    if (out.length > 2000) break
  }
  return out
}

/** The next non-cancelled occurrence at or after `now`, within 18 months. */
export function nextOccurrence(ev: Schedulable, now: Date): Occurrence | null {
  const found = expandOccurrences(ev, now, new Date(now.getTime() + MAX_WINDOW_DAYS * DAY))
  return found.find((o) => !o.cancelled && (o.endsAt ?? o.startsAt) >= now) ?? null
}
