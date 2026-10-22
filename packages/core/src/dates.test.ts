import { describe, expect, it } from 'vitest'
import { daysBetween, shortDate, weekLabel, weekOf } from './dates.ts'

describe('shortDate', () => {
  const d = new Date('2026-10-21T10:00:00Z')
  it('French and English short style with periods', () => {
    expect(shortDate(d, 'fr')).toBe('Mer. 21 Oct. 2026')
    expect(shortDate(d, 'en')).toBe('Wed. 21 Oct. 2026')
  })
  it('keeps short months without a period', () => {
    expect(shortDate(new Date('2026-05-06T10:00:00Z'), 'fr')).toBe('Mer. 6 Mai 2026')
  })
  it('uses the parish zone by default and UTC on request', () => {
    expect(shortDate(new Date('2026-10-20T23:30:00Z'), 'fr')).toBe('Mer. 21 Oct. 2026')
    expect(shortDate(new Date('2026-10-20T23:30:00Z'), 'fr', 'UTC')).toBe('Mar. 20 Oct. 2026')
  })
})
describe('weeks', () => {
  it('Monday to Sunday', () => {
    expect(weekOf('2026-10-21')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(weekOf('2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(weekOf('2026-10-26')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
  })
  it('labels in both languages', () => {
    expect(weekLabel('2026-10-21', 'fr')).toBe('Semaine du Lun. 19 Oct. 2026 au Dim. 25 Oct. 2026')
    expect(weekLabel('2026-10-21', 'en')).toBe('Week of Mon. 19 Oct. 2026 to Sun. 25 Oct. 2026')
  })
  it('lists the days of a span', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
    expect(daysBetween('2026-10-30', '2026-10-30')).toEqual(['2026-10-30'])
  })
})

import { spanDays } from './dates.ts'

describe('spanDays', () => {
  it('single day, multi-day, midnight end, all-day inclusive', () => {
    const z = (s: string) => new Date(s)
    expect(spanDays(z('2026-11-06T16:00:00Z'), null, false)).toEqual({
      from: '2026-11-06',
      to: '2026-11-06',
    })
    // Friday 17:00 to Sunday 14:00 (Douala)
    expect(spanDays(z('2026-11-06T16:00:00Z'), z('2026-11-08T13:00:00Z'), false)).toEqual({
      from: '2026-11-06',
      to: '2026-11-08',
    })
    // ends exactly at local midnight: the new day is not covered
    expect(spanDays(z('2026-11-06T16:00:00Z'), z('2026-11-06T23:00:00Z'), false)).toEqual({
      from: '2026-11-06',
      to: '2026-11-06',
    })
    expect(spanDays(z('2026-12-24T00:00:00Z'), z('2026-12-26T00:00:00Z'), true)).toEqual({
      from: '2026-12-24',
      to: '2026-12-26',
    })
  })
})
