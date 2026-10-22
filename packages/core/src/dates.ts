/**
 * One date style across the site and the admin: short, with the weekday and a period after each abbreviation —
 * « Mer. 21 Oct. 2026 » (fr), « Wed. 21 Oct. 2026 » (en). Plus the Monday–Sunday week a date belongs to.
 */
const cache = new Map<string, Intl.DateTimeFormat>()
const parts = (d: Date, locale: string, timeZone: string) => {
  const key = `${locale}|${timeZone}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone,
    })
    cache.set(key, f)
  }
  return f.formatToParts(d)
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dot = (s: string) => (s.endsWith('.') ? s : `${s}.`)

/** « Mer. 21 Oct. 2026 ». `timeZone` defaults to the parish zone; use 'UTC' for all-day dates stored at midnight UTC. */
export function shortDate(d: Date | string, locale: string, timeZone = 'Africa/Douala'): string {
  const p = parts(typeof d === 'string' ? new Date(d) : d, locale, timeZone)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  const month = get('month')
  // « mai » and « juin » have no abbreviation: no period there.
  const short = (v: string) =>
    v.length <= 3 && /^(mai|may|juin|june|jun|août|aug)$/i.test(v) ? cap(v) : cap(dot(v))
  return `${short(get('weekday'))} ${get('day')} ${short(month)} ${get('year')}`
}

/** Monday and Sunday (YYYY-MM-DD) of the week containing a local date. */
export function weekOf(date: string): { from: string; to: string } {
  const d = new Date(`${date}T00:00:00Z`)
  const back = (d.getUTCDay() + 6) % 7
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  const from = new Date(d.getTime() - back * 86_400_000)
  return { from: iso(from), to: iso(new Date(from.getTime() + 6 * 86_400_000)) }
}

/** « Semaine du Lun. 19 Oct. 2026 au Dim. 25 Oct. 2026 » */
export function weekLabel(date: string, locale: 'fr' | 'en'): string {
  const w = weekOf(date)
  const f = (s: string) => shortDate(new Date(`${s}T00:00:00Z`), locale, 'UTC')
  return locale === 'fr'
    ? `Semaine du ${f(w.from)} au ${f(w.to)}`
    : `Week of ${f(w.from)} to ${f(w.to)}`
}

/** Every local date from `from` to `to` inclusive (for events that span several days). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end && out.length < 62; t += 86_400_000)
    out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

/**
 * The local days an occurrence covers, first to last (a retreat from Friday evening to Sunday is three days). An
 * all-day event stores its last day at midnight UTC; a timed event that ends exactly at midnight does not count the
 * new day. Dates are in the event's zone.
 */
export function spanDays(
  startsAt: Date | string,
  endsAt: Date | string | null,
  allDay: boolean,
  timeZone = 'Africa/Douala',
): { from: string; to: string } {
  const zone = allDay ? 'UTC' : timeZone
  const key = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d)
  const start = new Date(startsAt)
  const from = key(start)
  if (!endsAt) return { from, to: from }
  let end = new Date(endsAt)
  if (end <= start) return { from, to: from }
  if (!allDay) {
    const midnight =
      new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(end) === '00:00'
    if (midnight) end = new Date(end.getTime() - 60_000)
  }
  const to = key(end)
  return { from, to: to < from ? from : to }
}
