/** What a person still has to do, worked out from dates and counts alone (pure, tested). Decision 0044. */
const DAY = 86_400_000
const shift = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)

/** The Monday of the week (Monday to Sunday) a date falls in: how notifications are grouped. */
export const weekOf = (d: string) => shift(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7))

/** The Sundays strictly before `today`, going back `weeks` weeks, newest first. */
export function pastSundays(today: string, weeks: number): string[] {
  const back = shift(today, -1)
  const last = shift(back, -new Date(`${back}T12:00:00Z`).getUTCDay())
  return Array.from({ length: weeks }, (_, i) => shift(last, -7 * i))
}

export type Done = { attendance: boolean; offerings: boolean; closed: boolean }
export type Due = { date: string; what: 'attendance' | 'offerings' | 'both' }

/** The Sundays still to report on, for someone who may enter attendance, offerings or both. A closed Sunday is done. */
export function dueSundays(
  sundays: string[],
  done: ReadonlyMap<string, Done>,
  may: { attendance: boolean; offerings: boolean },
): Due[] {
  const out: Due[] = []
  for (const date of sundays) {
    const d = done.get(date)
    if (d?.closed) continue
    const a = may.attendance && !d?.attendance
    const o = may.offerings && !d?.offerings
    if (a || o) out.push({ date, what: a && o ? 'both' : a ? 'attendance' : 'offerings' })
  }
  return out
}
