import { describe, expect, it } from 'vitest'
import {
  type Exception,
  expandOccurrences,
  nthWeekdayOfMonth,
  type Recurrence,
  type Schedulable,
  zonedToUtc,
} from './recurrence.ts'

const TZ = 'Africa/Douala'
// 2026-11-01 is a Sunday. 09:00 Douala = 08:00 UTC.
const sunday9 = zonedToUtc(2026, 11, 1, 9, 0, TZ)
const ev = (recurrence: Recurrence | null, extra: Partial<Schedulable> = {}): Schedulable => ({
  startsAt: sunday9,
  endsAt: new Date(sunday9.getTime() + 2 * 3600_000),
  allDay: false,
  timezone: TZ,
  recurrence,
  exceptions: [],
  ...extra,
})
const dates = (e: Schedulable, from: string, to: string) =>
  expandOccurrences(e, new Date(from), new Date(to)).map((o) => o.date)

describe('time zones', () => {
  it('converts Douala wall time to UTC (+1, no DST)', () => {
    expect(sunday9.toISOString()).toBe('2026-11-01T08:00:00.000Z')
    expect(zonedToUtc(2026, 7, 15, 0, 30, TZ).toISOString()).toBe('2026-07-14T23:30:00.000Z')
  })
  it('handles zones with DST too', () => {
    expect(zonedToUtc(2026, 7, 1, 9, 0, 'Europe/Paris').toISOString()).toBe(
      '2026-07-01T07:00:00.000Z',
    )
    expect(zonedToUtc(2026, 12, 1, 9, 0, 'Europe/Paris').toISOString()).toBe(
      '2026-12-01T08:00:00.000Z',
    )
  })
})

describe('nth weekday', () => {
  it('finds first and last weekdays', () => {
    expect(nthWeekdayOfMonth(2026, 11, 1, 0)).toBe(1) // 1st Sunday of Nov 2026
    expect(nthWeekdayOfMonth(2026, 11, 2, 0)).toBe(8)
    expect(nthWeekdayOfMonth(2026, 11, -1, 0)).toBe(29)
    expect(nthWeekdayOfMonth(2026, 2, -1, 6)).toBe(28) // last Saturday of Feb 2026
  })
})

describe('expandOccurrences', () => {
  it('a single event appears only in its window', () => {
    expect(dates(ev(null), '2026-10-01', '2026-12-01')).toEqual(['2026-11-01'])
    expect(dates(ev(null), '2026-11-02', '2026-12-01')).toEqual([])
  })
  it('weekly on Sundays, until a date (inclusive)', () => {
    const e = ev({ freq: 'weekly', byDay: [0], until: '2026-11-15' })
    expect(dates(e, '2026-10-01', '2027-01-01')).toEqual(['2026-11-01', '2026-11-08', '2026-11-15'])
  })
  it('weekly on several days, every 2 weeks, with a count', () => {
    const e = ev({ freq: 'weekly', byDay: [0, 3], interval: 2, count: 4 })
    // Sun 1 Nov, then (week +2) Wed 11 Nov is week +1.. start Sunday belongs to the Mon-based week of 26 Oct
    expect(dates(e, '2026-10-01', '2027-06-01')).toEqual([
      '2026-11-01',
      '2026-11-11',
      '2026-11-15',
      '2026-11-25',
    ])
  })
  it('monthly on the 1st Sunday and on the last Sunday', () => {
    const first = ev({ freq: 'monthly', mode: 'nthWeekday', nth: 1, weekday: 0, count: 3 })
    expect(dates(first, '2026-10-01', '2027-06-01')).toEqual([
      '2026-11-01',
      '2026-12-06',
      '2027-01-03',
    ])
    const last = ev(
      { freq: 'monthly', mode: 'nthWeekday', nth: -1, weekday: 0 },
      { startsAt: zonedToUtc(2026, 11, 29, 9, 0, TZ), endsAt: null },
    )
    expect(dates(last, '2026-11-01', '2027-02-01')).toEqual([
      '2026-11-29',
      '2026-12-27',
      '2027-01-31',
    ])
  })
  it('monthly on day 31 skips short months', () => {
    const e = ev(
      { freq: 'monthly', mode: 'monthday', day: 31 },
      { startsAt: zonedToUtc(2026, 10, 31, 9, 0, TZ), endsAt: null },
    )
    expect(dates(e, '2026-10-01', '2027-02-01')).toEqual(['2026-10-31', '2026-12-31', '2027-01-31'])
  })
  it('a late-evening event stays on its local day (UTC day differs)', () => {
    const late = zonedToUtc(2026, 11, 1, 0, 30, TZ) // 23:30 UTC the day before
    const e = ev({ freq: 'weekly', byDay: [0] }, { startsAt: late, endsAt: null })
    expect(dates(e, '2026-10-30', '2026-11-20')).toEqual(['2026-11-01', '2026-11-08', '2026-11-15'])
  })
  it('keeps the local time across occurrences and the duration', () => {
    const o = expandOccurrences(
      ev({ freq: 'weekly', byDay: [0] }),
      new Date('2026-11-07'),
      new Date('2026-11-10'),
    )[0]
    expect(o?.startsAt.toISOString()).toBe('2026-11-08T08:00:00.000Z')
    expect(o?.endsAt?.toISOString()).toBe('2026-11-08T10:00:00.000Z')
  })
  it('cancelled and moved occurrences', () => {
    const exceptions: Exception[] = [
      { date: '2026-11-08', kind: 'cancelled', noteFr: 'Annulé' },
      { date: '2026-11-15', kind: 'moved', startsAt: '2026-11-15T15:00:00.000Z' },
    ]
    const out = expandOccurrences(
      ev({ freq: 'weekly', byDay: [0], until: '2026-11-22' }, { exceptions }),
      new Date('2026-10-01'),
      new Date('2027-01-01'),
    )
    expect(out.map((o) => [o.date, o.cancelled, o.moved])).toEqual([
      ['2026-11-01', false, false],
      ['2026-11-08', true, false],
      ['2026-11-15', false, true],
      ['2026-11-22', false, false],
    ])
    expect(out[1]?.noteFr).toBe('Annulé')
    expect(out[2]?.startsAt.toISOString()).toBe('2026-11-15T15:00:00.000Z')
    expect(out[2]?.endsAt?.toISOString()).toBe('2026-11-15T17:00:00.000Z')
  })
  it('caps the window at 18 months and never loops forever', () => {
    const out = expandOccurrences(
      ev({ freq: 'weekly', byDay: [0, 1, 2, 3, 4, 5, 6] }),
      new Date('2026-11-01'),
      new Date('2036-11-01'),
    )
    expect(out.length).toBeLessThan(560 + 7)
  })
})
