/** « Ce dimanche »: which Sunday to show, and the name the season logic suggests for it (editable in the admin). */

import { easterSunday, getSeason, type Season } from './liturgy.ts'
import { localDate, PARISH_TZ } from './schedule.ts'

const shift = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const x = new Date(Date.UTC(y, m - 1, d + days))
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`
}
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

/** The Sunday to show: today's until 14:00 (local), otherwise the coming one. Returns YYYY-MM-DD. */
export function comingSunday(now: Date, tz = PARISH_TZ): string {
  const today = localDate(now, tz)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(
      now,
    ),
  )
  if (dow(today) === 0) return hour < 14 ? today : shift(today, 7)
  return shift(today, (7 - dow(today)) % 7)
}

/** The next `n` Sundays starting from `from` (a Sunday date). */
export const sundaysFrom = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => shift(from, i * 7))

const atNoon = (date: string) => new Date(`${date}T12:00:00Z`)

/** « 2e dimanche de l’Avent »… The count is the position of this Sunday inside its season. */
export function suggestSundayName(date: string): { fr: string; en: string; season: Season } {
  const season = getSeason(atNoon(date))
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const easter = easterSunday(y)
  const isEaster = easter.year === y && easter.month === m && easter.day === d
  let n = 1
  for (
    let back = shift(date, -7);
    getSeason(atNoon(back)) === season && n < 10;
    back = shift(back, -7)
  )
    n++
  const ord = (k: number) => ({
    fr: k === 1 ? '1er' : `${k}e`,
    en: ['1st', '2nd', '3rd'][k - 1] ?? `${k}th`,
  })
  const o = ord(n)
  switch (season) {
    case 'avent':
      return { fr: `${o.fr} dimanche de l’Avent`, en: `${o.en} Sunday of Advent`, season }
    case 'careme':
      return { fr: `${o.fr} dimanche de Carême`, en: `${o.en} Sunday of Lent`, season }
    case 'semaine-sainte':
      return { fr: 'Dimanche des Rameaux', en: 'Palm Sunday', season }
    case 'paques':
      return isEaster
        ? { fr: 'Dimanche de Pâques', en: 'Easter Sunday', season }
        : { fr: `${o.fr} dimanche de Pâques`, en: `${o.en} Sunday of Easter`, season }
    case 'pentecote':
      return { fr: 'Dimanche de la Pentecôte', en: 'Pentecost Sunday', season }
    case 'noel':
      return { fr: 'Dimanche du temps de Noël', en: 'Sunday of Christmastide', season }
    case 'epiphanie':
      return { fr: 'Dimanche de l’Épiphanie', en: 'Sunday of Epiphany', season }
    case 'moissons':
      return { fr: 'Dimanche de la Fête des Moissons', en: 'Harvest Festival Sunday', season }
    default:
      return { fr: 'Dimanche du temps ordinaire', en: 'Sunday in Ordinary Time', season }
  }
}
