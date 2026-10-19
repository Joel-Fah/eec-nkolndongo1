/**
 * Liturgical season of a date (Protestant/Western calendar), computed — no admin action needed.
 * Framework-free: only `Date` and `Intl`.
 *
 *   avent           4th Sunday before Christmas → 24 Dec
 *   noel            25 Dec → 5 Jan
 *   epiphanie       6 Jan → the following Sunday (Baptism of the Lord)
 *   ordinaire       the rest — before Lent and after Pentecost week
 *   careme          Ash Wednesday (Easter − 46) → Saturday before Palm Sunday (Easter − 8)
 *   semaine-sainte  Palm Sunday (Easter − 7) → Holy Saturday (Easter − 1)
 *   paques          Easter Sunday → Saturday before Pentecost (Easter + 48)
 *   pentecote       Pentecost Sunday (Easter + 49) → the Saturday after (Easter + 55)
 *   moissons        NOT computed: an admin-set date range (Fête des Moissons), passed as `harvest`
 *                   or forced with `override`.
 *
 * The exact end of Épiphanie and of Pentecôte, and treating Advent as one season, are conventions
 * chosen here — to confirm with the parish.
 */

export const SEASONS = [
  'avent',
  'noel',
  'epiphanie',
  'careme',
  'semaine-sainte',
  'paques',
  'pentecote',
  'ordinaire',
  'moissons',
] as const
export type Season = (typeof SEASONS)[number]

export const DEFAULT_TIME_ZONE = 'Africa/Douala'

/** A calendar day, independent of time zones. */
export type CivilDate = { year: number; month: number; day: number }

const MS_PER_DAY = 86_400_000
const dayNumber = ({ year, month, day }: CivilDate) =>
  Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY)

function fromDayNumber(n: number): CivilDate {
  const d = new Date(n * MS_PER_DAY)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Weekday of a civil date, 0 = Sunday. */
const weekday = (date: CivilDate) =>
  new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()

/** The civil date of `instant` in `timeZone`. */
export function civilDateIn(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** Easter Sunday (Gregorian), by the Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): CivilDate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { year, month, day }
}

/** First Sunday of Advent: the 4th Sunday before 25 December (27 Nov – 3 Dec). */
export function adventStart(year: number): CivilDate {
  const christmas = dayNumber({ year, month: 12, day: 25 })
  const lastSundayBefore = christmas - (weekday({ year, month: 12, day: 25 }) || 7)
  return fromDayNumber(lastSundayBefore - 21)
}

export type SeasonRange = { season: Exclude<Season, 'moissons'>; from: CivilDate; to: CivilDate }

/** The seasons that start in `year`'s civil calendar, in order (ordinaire fills the gaps). */
export function seasonRanges(year: number): SeasonRange[] {
  const easter = dayNumber(easterSunday(year))
  const range = (season: SeasonRange['season'], from: number, to: number): SeasonRange => ({
    season,
    from: fromDayNumber(from),
    to: fromDayNumber(to),
  })
  const jan6 = dayNumber({ year, month: 1, day: 6 })
  const epiphanyEnd = jan6 + (7 - weekday({ year, month: 1, day: 6 }))
  const advent = dayNumber(adventStart(year))
  const dec25 = dayNumber({ year, month: 12, day: 25 })
  return [
    range('noel', dayNumber({ year, month: 1, day: 1 }), jan6 - 1),
    range('epiphanie', jan6, epiphanyEnd),
    range('ordinaire', epiphanyEnd + 1, easter - 47),
    range('careme', easter - 46, easter - 8),
    range('semaine-sainte', easter - 7, easter - 1),
    range('paques', easter, easter + 48),
    range('pentecote', easter + 49, easter + 55),
    range('ordinaire', easter + 56, advent - 1),
    range('avent', advent, dec25 - 1),
    range('noel', dec25, dayNumber({ year, month: 12, day: 31 })),
  ]
}

export type GetSeasonOptions = {
  timeZone?: string
  /** Forces a season (admin preview or a one-off). Wins over everything. */
  override?: Season | null
  /** Fête des Moissons: admin-set, inclusive, `YYYY-MM-DD` in the parish time zone. */
  harvest?: { from: string; to: string } | null
}

const parseIso = (iso: string): CivilDate => {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) throw new Error(`Invalid date: ${iso}`)
  return { year, month, day }
}

/** Liturgical season for an instant (default: now) in the parish time zone (Africa/Douala). */
export function getSeason(instant: Date = new Date(), options: GetSeasonOptions = {}): Season {
  if (options.override) return options.override
  const date = civilDateIn(instant, options.timeZone)
  const n = dayNumber(date)

  if (options.harvest) {
    const { from, to } = options.harvest
    if (n >= dayNumber(parseIso(from)) && n <= dayNumber(parseIso(to))) return 'moissons'
  }
  for (const range of seasonRanges(date.year)) {
    if (n >= dayNumber(range.from) && n <= dayNumber(range.to)) return range.season
  }
  return 'ordinaire'
}
