/** The arithmetic of Sunday reports, pure and tested: Sunday dates, totals, rollups by week or month, XAF text. */
export const amountOk = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 500_000_000
export const countOk = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100_000
export const xaf = (n: number) =>
  `${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`

export const isSundayDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  new Date(`${d}T12:00:00Z`).getUTCDay() === 0 &&
  new Date(`${d}T12:00:00Z`).toISOString().startsWith(d)
const shift = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
/** The Sunday just before (or on) a day. */
export const sundayOnOrBefore = (d: string) => shift(d, -new Date(`${d}T12:00:00Z`).getUTCDay())
/** The last Sunday whose figures are normally told: today's if it is Sunday evening is not assumed, so: strictly before today. */
export const lastSunday = (today: string) => sundayOnOrBefore(shift(today, -1))

export type Attendance = { men: number | null; women: number | null; children: number | null }
export const attendanceTotal = (a: Attendance) => (a.men ?? 0) + (a.women ?? 0) + (a.children ?? 0)
export const attendanceKnown = (a: Attendance) =>
  a.men !== null || a.women !== null || a.children !== null

export type Line = { purpose: string; amountXaf: number; groupId: string | null }
export const offeringsTotal = (lines: Line[]) => lines.reduce((n, l) => n + l.amountXaf, 0)
/** Sum by purpose, biggest first. */
export function byPurpose(lines: Line[]) {
  const m = new Map<string, number>()
  for (const l of lines) m.set(l.purpose, (m.get(l.purpose) ?? 0) + l.amountXaf)
  return [...m.entries()]
    .map(([purpose, amount]) => ({ purpose, amount }))
    .sort((a, b) => b.amount - a.amount)
}
/** Sum by group; the congregation (no group) is its own entry (`null`). */
export function byGroup(lines: Line[]) {
  const m = new Map<string | null, number>()
  for (const l of lines) m.set(l.groupId, (m.get(l.groupId) ?? 0) + l.amountXaf)
  return [...m.entries()]
    .map(([groupId, amount]) => ({ groupId, amount }))
    .sort((a, b) => b.amount - a.amount)
}

/** Which period a Sunday belongs to: its month (`2026-10`) or its ISO week's Monday (`2026-10-19`). */
export const periodOf = (date: string, grain: 'week' | 'month') =>
  grain === 'month' ? date.slice(0, 7) : shift(date, -6)

/** Roll reports up by period (oldest first), zero-filled between the first and the last. */
export function rollup(
  reports: {
    date: string
    men: number | null
    women: number | null
    children: number | null
    lines: Line[]
  }[],
  grain: 'week' | 'month',
) {
  const seen = new Set<string>()
  const m = new Map<
    string,
    {
      period: string
      sundays: number
      men: number
      women: number
      children: number
      offerings: number
      byPurpose: Map<string, number>
    }
  >()
  for (const r of reports) {
    const p = periodOf(r.date, grain)
    const e = m.get(p) ?? {
      period: p,
      sundays: 0,
      men: 0,
      women: 0,
      children: 0,
      offerings: 0,
      byPurpose: new Map(),
    }
    // A Sunday with several services still counts once.
    if (!seen.has(`${p}|${r.date}`)) {
      seen.add(`${p}|${r.date}`)
      e.sundays++
    }
    e.men += r.men ?? 0
    e.women += r.women ?? 0
    e.children += r.children ?? 0
    for (const l of r.lines) {
      e.offerings += l.amountXaf
      e.byPurpose.set(l.purpose, (e.byPurpose.get(l.purpose) ?? 0) + l.amountXaf)
    }
    m.set(p, e)
  }
  return [...m.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((e) => ({
      ...e,
      attendance: e.men + e.women + e.children,
      byPurpose: Object.fromEntries(e.byPurpose),
    }))
}

/** Change from the previous period as a whole percent (null when there is nothing to compare). */
export const trend = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null

/** A CSV cell that cannot run as a formula. */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
