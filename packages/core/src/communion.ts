/**
 * The carte de Sainte-Cène (decision 0050), pure rules: the Communion Sunday is the second Sunday of each month; the preparation is the week
 * before it (Monday to Saturday by default); the streak counts consecutive Communion Sundays with a visa, and a month the member excused
 * pauses it instead of breaking it. Nothing here touches a database, so it can be tested; months are « YYYY-MM ».
 */
export type Month = string

const pad = (n: number) => String(n).padStart(2, '0')
export const monthKey = (year: number, month1: number): Month => `${year}-${pad(month1)}`
const parse = (m: Month) => ({ y: Number(m.slice(0, 4)), mo: Number(m.slice(5, 7)) })

/** The second Sunday of the month, as YYYY-MM-DD. */
export function communionSunday(month: Month): string {
  const { y, mo } = parse(month)
  const first = new Date(Date.UTC(y, mo - 1, 1))
  const toSunday = (7 - first.getUTCDay()) % 7
  return new Date(Date.UTC(y, mo - 1, 1 + toSunday + 7)).toISOString().slice(0, 10)
}

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** The preparation week: the Monday to the Saturday before the Communion Sunday (inclusive). */
export function preparationWeek(month: Month): { from: string; to: string } {
  const sunday = communionSunday(month)
  return { from: addDays(sunday, -6), to: addDays(sunday, -1) }
}

/** The month whose preparation week contains this day, if any (the week can start in the previous month). */
export function preparationMonthOn(day: string): Month | null {
  for (const m of [day.slice(0, 7), nextMonth(day.slice(0, 7))]) {
    const w = preparationWeek(m)
    if (day >= w.from && day <= w.to) return m
  }
  return null
}

export function nextMonth(m: Month): Month {
  const { y, mo } = parse(m)
  return mo === 12 ? monthKey(y + 1, 1) : monthKey(y, mo + 1)
}
export function prevMonth(m: Month): Month {
  const { y, mo } = parse(m)
  return mo === 1 ? monthKey(y - 1, 12) : monthKey(y, mo - 1)
}

export type MonthState = 'signed' | 'excused' | 'missed' | 'open' | 'future' | 'before'
/**
 * The state of one month on the card, seen on `today`:
 * signed (a visa), excused (the member said so), open (the Communion Sunday is not over yet), missed (it passed with neither),
 * future (a later month), before (the month is before the card existed: it does not count).
 */
export function monthState(
  m: Month,
  today: string,
  o: { signed: ReadonlySet<Month>; excused: ReadonlySet<Month>; since: Month },
): MonthState {
  if (m < o.since) return 'before'
  if (o.signed.has(m)) return 'signed'
  if (o.excused.has(m)) return 'excused'
  const sunday = communionSunday(m)
  if (today > sunday) return 'missed'
  return m === today.slice(0, 7) || preparationMonthOn(today) === m ? 'open' : 'future'
}

/** Consecutive months with a visa, newest first; an excused month is skipped (neither counted nor breaking); an open month is not counted yet. */
export function streak(
  today: string,
  o: { signed: ReadonlySet<Month>; excused: ReadonlySet<Month>; since: Month },
): number {
  let n = 0
  let m = today.slice(0, 7)
  for (let i = 0; i < 240; i++) {
    const s = monthState(m, today, o)
    if (s === 'before') break
    if (s === 'signed') n++
    else if (s === 'missed') break
    m = prevMonth(m)
  }
  return n
}

/** The eleven or twelve months shown on the card for a civil year. */
export const monthsOf = (year: number): Month[] =>
  Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1))
