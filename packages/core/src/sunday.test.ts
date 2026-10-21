import { describe, expect, it } from 'vitest'
import { zonedToUtc } from './recurrence.ts'
import { comingSunday, suggestSundayName, sundaysFrom } from './sunday.ts'

const at = (y: number, m: number, d: number, h: number) =>
  zonedToUtc(y, m, d, h, 0, 'Africa/Douala')

describe('comingSunday', () => {
  it('today until 14:00, then the next one; from other days, the coming Sunday', () => {
    expect(comingSunday(at(2026, 10, 25, 9))).toBe('2026-10-25')
    expect(comingSunday(at(2026, 10, 25, 13))).toBe('2026-10-25')
    expect(comingSunday(at(2026, 10, 25, 15))).toBe('2026-11-01')
    expect(comingSunday(at(2026, 10, 21, 10))).toBe('2026-10-25')
    expect(comingSunday(at(2026, 10, 24, 23))).toBe('2026-10-25')
  })
  it('lists consecutive Sundays', () => {
    expect(sundaysFrom('2026-10-25', 3)).toEqual(['2026-10-25', '2026-11-01', '2026-11-08'])
  })
})

describe('suggestSundayName', () => {
  it('counts Sundays inside their season', () => {
    // Advent 2026 starts on Sunday 29 November.
    expect(suggestSundayName('2026-11-29').fr).toBe('1er dimanche de l’Avent')
    expect(suggestSundayName('2026-12-13').en).toBe('3rd Sunday of Advent')
    // Easter 2027 is 28 March; Palm Sunday 21 March.
    expect(suggestSundayName('2027-03-21').fr).toBe('Dimanche des Rameaux')
    expect(suggestSundayName('2027-03-28').fr).toBe('Dimanche de Pâques')
    expect(suggestSundayName('2027-04-04').fr).toBe('2e dimanche de Pâques')
    expect(suggestSundayName('2027-05-16').fr).toBe('Dimanche de la Pentecôte')
    expect(suggestSundayName('2026-10-25').fr).toBe('Dimanche du temps ordinaire')
  })
})
