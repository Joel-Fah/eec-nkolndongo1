import { describe, expect, it } from 'vitest'
import {
  amountOk,
  attendanceTotal,
  byGroup,
  byPurpose,
  countOk,
  csvCell,
  isSundayDate,
  lastSunday,
  offeringsTotal,
  periodOf,
  rollup,
  sundayOnOrBefore,
  trend,
  xaf,
} from './rules.ts'

describe('Sundays', () => {
  it('knows what a Sunday is', () => {
    expect(isSundayDate('2026-10-25')).toBe(true)
    expect(isSundayDate('2026-10-24')).toBe(false)
    expect(isSundayDate('2026-02-30')).toBe(false)
    expect(isSundayDate('nope')).toBe(false)
  })
  it('finds the Sunday to report on', () => {
    expect(sundayOnOrBefore('2026-10-27')).toBe('2026-10-25')
    expect(sundayOnOrBefore('2026-10-25')).toBe('2026-10-25')
    expect(lastSunday('2026-10-27')).toBe('2026-10-25')
    expect(lastSunday('2026-10-25')).toBe('2026-10-18')
  })
})
describe('counts and money', () => {
  it('accepts whole numbers only', () => {
    expect(countOk(0)).toBe(true)
    for (const bad of [-1, 1.5, '3', null, 200_000]) expect(countOk(bad)).toBe(false)
    for (const bad of [0, -5, 1.5, '1', 600_000_000]) expect(amountOk(bad)).toBe(false)
    expect(xaf(1250000)).toBe('1 250 000 FCFA')
  })
  it('totals attendance, treating what is not entered as zero', () => {
    expect(attendanceTotal({ men: 30, women: 45, children: null })).toBe(75)
  })
})
describe('offerings', () => {
  const lines = [
    { purpose: 'ordinaire', amountXaf: 50000, groupId: null },
    { purpose: 'ordinaire', amountXaf: 20000, groupId: 'g1' },
    { purpose: 'travaux', amountXaf: 100000, groupId: null },
    { purpose: 'Réformation', amountXaf: 10000, groupId: null },
  ]
  it('sums by purpose and by group (no group = the congregation)', () => {
    expect(offeringsTotal(lines)).toBe(180000)
    expect(byPurpose(lines)[0]).toEqual({ purpose: 'travaux', amount: 100000 })
    expect(byGroup(lines)).toEqual([
      { groupId: null, amount: 160000 },
      { groupId: 'g1', amount: 20000 },
    ])
  })
})
describe('weekly and monthly trends', () => {
  const rep = (
    date: string,
    men: number,
    lines: { purpose: string; amountXaf: number; groupId: null }[],
  ) => ({ date, men, women: 10, children: 5, lines })
  const reports = [
    rep('2026-10-04', 20, [{ purpose: 'ordinaire', amountXaf: 1000, groupId: null }]),
    rep('2026-10-11', 30, [{ purpose: 'ordinaire', amountXaf: 3000, groupId: null }]),
    rep('2026-11-01', 40, [{ purpose: 'dime', amountXaf: 5000, groupId: null }]),
  ]
  it('groups Sundays by their week (Monday) or month', () => {
    expect(periodOf('2026-10-25', 'week')).toBe('2026-10-19')
    expect(periodOf('2026-10-25', 'month')).toBe('2026-10')
  })
  it('rolls up by month with attendance and offerings by purpose', () => {
    const r = rollup(reports, 'month')
    expect(r.map((x) => x.period)).toEqual(['2026-10', '2026-11'])
    expect(r[0]).toMatchObject({ sundays: 2, men: 50, attendance: 50 + 20 + 10, offerings: 4000 })
    expect(r[1]?.byPurpose).toEqual({ dime: 5000 })
  })
  it('compares with the period before', () => {
    expect(trend(150, 100)).toBe(50)
    expect(trend(50, 100)).toBe(-50)
    expect(trend(5, 0)).toBeNull()
  })
})
it('defuses spreadsheet formulas', () => {
  expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
  expect(csvCell(null)).toBe('""')
})
