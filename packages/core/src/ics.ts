/**
 * iCalendar (RFC 5545) files for events and subscribable feeds (decision 0029). No dependency.
 * Rules honoured: CRLF line ends; lines folded at 75 octets (never inside a UTF-8 character); TEXT escaping of
 * backslash, comma, semicolon and newline; UID and DTSTAMP on every event; times in the event's own zone with a
 * VTIMEZONE (a fixed offset, true for Africa/Douala) so « every Sunday » stays on Sunday; UNTIL in UTC (required
 * when DTSTART has a TZID); COUNT and UNTIL never together; cancelled or moved occurrences as EXDATE, and moved ones
 * also as an override VEVENT with RECURRENCE-ID.
 */
import {
  localParts,
  offsetMinutes,
  type Recurrence,
  type Schedulable,
  zonedToUtc,
} from './recurrence.ts'

const enc = new TextEncoder()
const CRLF = '\r\n'

/** Fold one content line at 75 octets, continuing with a single space. */
export function fold(line: string): string {
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    const limit = out.length === 0 ? 75 : 74 // continuation lines start with a space
    if (size + n > limit) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join(`${CRLF} `)
}

export const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, ';').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const utcStamp = (d: Date) =>
  `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const localStamp = (d: Date, tz: string) => {
  const p = localParts(d, tz)
  return `${pad(p.y, 4)}${pad(p.m)}${pad(p.d)}T${pad(p.hh)}${pad(p.mm)}${pad(p.ss)}`
}
const dateStamp = (d: Date) =>
  `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function rrule(r: Recurrence, tz: string): string {
  const parts = [`FREQ=${r.freq.toUpperCase()}`]
  if (r.interval && r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'weekly')
    parts.push(
      `BYDAY=${[...r.byDay]
        .sort()
        .map((d) => DAYS[d])
        .join(',')}`,
    )
  else if (r.mode === 'nthWeekday') parts.push(`BYDAY=${r.nth}${DAYS[r.weekday]}`)
  else parts.push(`BYMONTHDAY=${r.day}`)
  if (r.count) parts.push(`COUNT=${r.count}`)
  else if (r.until) {
    const [y, m, d] = r.until.split('-').map(Number) as [number, number, number]
    // End of that local day, as a UTC instant.
    parts.push(`UNTIL=${utcStamp(new Date(zonedToUtc(y, m, d, 23, 59, tz).getTime() + 59_000))}`)
  }
  return parts.join(';')
}

export function vtimezone(tz: string, at: Date): string[] {
  const off = offsetMinutes(at, tz)
  const fmt = (min: number) => {
    const sign = min < 0 ? '-' : '+'
    const a = Math.abs(min)
    return `${sign}${pad(Math.floor(a / 60))}${pad(a % 60)}`
  }
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${tz}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${fmt(off)}`,
    `TZOFFSETTO:${fmt(off)}`,
    `TZNAME:${tz === 'Africa/Douala' ? 'WAT' : tz}`,
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

export type IcsEvent = Schedulable & {
  id: string
  title: string
  description?: string
  location?: string
  url?: string
  /** Last change, for SEQUENCE-free caching of feeds. */
  updatedAt?: Date
}

function vevent(e: IcsEvent, now: Date): string[] {
  const tz = e.timezone
  const dt = (name: string, d: Date) =>
    e.allDay ? `${name};VALUE=DATE:${dateStamp(d)}` : `${name};TZID=${tz}:${localStamp(d, tz)}`
  const lines = [
    'BEGIN:VEVENT',
    `UID:${e.id}@eec-nkolndongo1`,
    `DTSTAMP:${utcStamp(e.updatedAt ?? now)}`,
    dt('DTSTART', e.startsAt),
  ]
  if (e.allDay) lines.push(dt('DTEND', new Date((e.endsAt ?? e.startsAt).getTime() + 86_400_000)))
  else if (e.endsAt) lines.push(dt('DTEND', e.endsAt))
  lines.push(`SUMMARY:${escapeText(e.title)}`)
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`)
  if (e.url) lines.push(`URL:${e.url}`)
  if (e.recurrence) {
    lines.push(`RRULE:${rrule(e.recurrence, tz)}`)
    const gone = e.exceptions.filter((x) => x.kind === 'cancelled' || x.kind === 'moved')
    for (const x of gone) {
      const [y, m, d] = x.date.split('-').map(Number) as [number, number, number]
      const local = localParts(e.startsAt, tz)
      const at = e.allDay ? null : zonedToUtc(y, m, d, local.hh, local.mm, tz)
      lines.push(
        e.allDay
          ? `EXDATE;VALUE=DATE:${x.date.replaceAll('-', '')}`
          : `EXDATE;TZID=${tz}:${localStamp(at as Date, tz)}`,
      )
    }
  }
  lines.push('END:VEVENT')
  // A moved occurrence is its own event pointing at the original slot.
  if (e.recurrence) {
    for (const x of e.exceptions) {
      if (x.kind !== 'moved' || !x.startsAt) continue
      const [y, m, d] = x.date.split('-').map(Number) as [number, number, number]
      const local = localParts(e.startsAt, tz)
      const original = e.allDay
        ? new Date(Date.UTC(y, m - 1, d))
        : zonedToUtc(y, m, d, local.hh, local.mm, tz)
      const start = new Date(x.startsAt)
      const end = x.endsAt
        ? new Date(x.endsAt)
        : e.endsAt
          ? new Date(start.getTime() + (e.endsAt.getTime() - e.startsAt.getTime()))
          : null
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.id}@eec-nkolndongo1`,
        `DTSTAMP:${utcStamp(e.updatedAt ?? now)}`,
        dt('RECURRENCE-ID', original),
        dt('DTSTART', start),
        ...(end ? [dt('DTEND', end)] : []),
        `SUMMARY:${escapeText(e.title)}`,
        ...(x.noteFr ? [`DESCRIPTION:${escapeText(x.noteFr)}`] : []),
        'END:VEVENT',
      )
    }
  }
  return lines
}

/** A complete calendar. `name` is shown by calendar apps for subscribed feeds. */
export function buildIcs(opts: {
  name: string
  events: IcsEvent[]
  now?: Date
  timezone?: string
}): string {
  const now = opts.now ?? new Date()
  const tzs = [...new Set(opts.events.filter((e) => !e.allDay).map((e) => e.timezone))]
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EEC Nkolndongo 1//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `X-WR-TIMEZONE:${opts.timezone ?? 'Africa/Douala'}`,
    // Subscribed feeds are refreshed about every hour.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...tzs.flatMap((tz) => vtimezone(tz, now)),
    ...opts.events.flatMap((e) => vevent(e, now)),
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join(CRLF)}${CRLF}`
}
