import { describe, expect, it } from 'vitest'
import {
  adventStart,
  civilDateIn,
  easterSunday,
  getSeason,
  SEASONS,
  seasonRanges,
} from './liturgy.ts'

const iso = ({ year, month, day }: { year: number; month: number; day: number }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
/** Noon UTC = 13:00 in Douala: same civil day everywhere in the tests. */
const on = (date: string) => new Date(`${date}T12:00:00Z`)

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
  ])('%i → %s', (year, expected) => {
    expect(iso(easterSunday(year))).toBe(expected)
  })
})

describe('adventStart', () => {
  it.each([
    [2025, '2025-11-30'],
    [2026, '2026-11-29'],
    [2027, '2027-11-28'],
    [2028, '2028-12-03'], // Christmas on a Monday → Advent starts 3 Dec
    [2029, '2029-12-02'],
    [2030, '2030-12-01'],
  ])('%i → %s', (year, expected) => {
    expect(iso(adventStart(year))).toBe(expected)
  })
})

describe('getSeason (2026: Easter 5 April)', () => {
  it.each([
    ['2026-01-01', 'noel'],
    ['2026-01-05', 'noel'],
    ['2026-01-06', 'epiphanie'],
    ['2026-01-11', 'epiphanie'], // Sunday after Epiphany
    ['2026-01-12', 'ordinaire'],
    ['2026-02-17', 'ordinaire'], // day before Ash Wednesday
    ['2026-02-18', 'careme'], // Ash Wednesday = Easter − 46
    ['2026-03-28', 'careme'], // Saturday before Palm Sunday
    ['2026-03-29', 'semaine-sainte'], // Palm Sunday
    ['2026-04-04', 'semaine-sainte'], // Holy Saturday
    ['2026-04-05', 'paques'],
    ['2026-05-23', 'paques'], // Saturday before Pentecost
    ['2026-05-24', 'pentecote'], // Pentecost = Easter + 49
    ['2026-05-30', 'pentecote'],
    ['2026-05-31', 'ordinaire'],
    ['2026-11-28', 'ordinaire'],
    ['2026-11-29', 'avent'],
    ['2026-12-24', 'avent'],
    ['2026-12-25', 'noel'],
    ['2026-12-31', 'noel'],
  ])('%s → %s', (date, season) => {
    expect(getSeason(on(date))).toBe(season)
  })
})

describe('getSeason, other years', () => {
  it('handles an early Easter (2027-03-28) and a late one (2030-04-21)', () => {
    expect(getSeason(on('2027-02-10'))).toBe('careme') // Ash Wednesday 2027
    expect(getSeason(on('2027-03-28'))).toBe('paques')
    expect(getSeason(on('2030-03-06'))).toBe('careme') // Ash Wednesday 2030
    expect(getSeason(on('2030-04-21'))).toBe('paques')
    expect(getSeason(on('2030-06-09'))).toBe('pentecote')
  })
  it('covers every day of 2025–2030 with exactly one season', () => {
    for (let year = 2025; year <= 2030; year++) {
      const ranges = seasonRanges(year)
      let expected = Date.UTC(year, 0, 1)
      for (const r of ranges) {
        expect(Date.UTC(r.from.year, r.from.month - 1, r.from.day)).toBe(expected)
        expected = Date.UTC(r.to.year, r.to.month - 1, r.to.day) + 86_400_000
      }
      expect(expected).toBe(Date.UTC(year + 1, 0, 1))
    }
  })
})

describe('time zone', () => {
  it('uses the parish civil day (Africa/Douala, UTC+1)', () => {
    // 2026-02-17 23:30 UTC is already 18 Feb in Douala → Ash Wednesday
    expect(getSeason(new Date('2026-02-17T23:30:00Z'))).toBe('careme')
    expect(getSeason(new Date('2026-02-17T23:30:00Z'), { timeZone: 'UTC' })).toBe('ordinaire')
    expect(iso(civilDateIn(new Date('2026-12-31T23:30:00Z')))).toBe('2027-01-01')
  })
})

describe('moissons and override', () => {
  it('moissons only comes from the admin-set range', () => {
    const harvest = { from: '2026-10-25', to: '2026-11-01' }
    expect(getSeason(on('2026-10-24'), { harvest })).toBe('ordinaire')
    expect(getSeason(on('2026-10-25'), { harvest })).toBe('moissons')
    expect(getSeason(on('2026-11-01'), { harvest })).toBe('moissons')
    expect(getSeason(on('2026-11-02'), { harvest })).toBe('ordinaire')
    expect(getSeason(on('2026-10-25'))).toBe('ordinaire')
  })
  it('override wins', () => {
    expect(getSeason(on('2026-04-05'), { override: 'avent' })).toBe('avent')
    expect(getSeason(on('2026-04-05'), { override: null })).toBe('paques')
  })
  it('lists the nine seasons used by the design tokens', () => {
    expect(SEASONS).toHaveLength(9)
  })
})
