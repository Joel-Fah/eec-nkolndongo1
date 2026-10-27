import { describe, expect, it } from 'vitest'
import {
  communionSunday,
  monthState,
  preparationMonthOn,
  preparationWeek,
  streak,
} from './communion.ts'

const none = new Set<string>()
describe('Communion Sunday and preparation', () => {
  it('is the second Sunday of the month', () => {
    expect(communionSunday('2026-11')).toBe('2026-11-08')
    expect(communionSunday('2026-02')).toBe('2026-02-08')
    expect(communionSunday('2026-03')).toBe('2026-03-08')
    expect(communionSunday('2026-08')).toBe('2026-08-09')
  })
  it('prepares from the Monday to the Saturday before', () => {
    expect(preparationWeek('2026-11')).toEqual({ from: '2026-11-02', to: '2026-11-07' })
    // a week that starts in the previous month
    expect(preparationWeek('2026-02')).toEqual({ from: '2026-02-02', to: '2026-02-07' })
    expect(preparationMonthOn('2026-11-04')).toBe('2026-11')
    expect(preparationMonthOn('2026-11-09')).toBeNull()
  })
})

describe('months and streak', () => {
  const o = (signed: string[], excused: string[] = [], since = '2026-01') => ({
    signed: new Set(signed),
    excused: new Set(excused),
    since,
  })
  it('a month before the card does not count', () => {
    expect(monthState('2025-12', '2026-03-20', o([]))).toBe('before')
  })
  it('counts consecutive signed months, newest first', () => {
    expect(streak('2026-04-20', o(['2026-01', '2026-02', '2026-03', '2026-04']))).toBe(4)
    expect(streak('2026-04-20', o(['2026-01', '2026-03', '2026-04']))).toBe(2)
  })
  it('an open month is not counted yet and does not break the streak', () => {
    expect(monthState('2026-04', '2026-04-05', o([]))).toBe('open')
    expect(streak('2026-04-05', o(['2026-02', '2026-03']))).toBe(2)
  })
  it('an excused month pauses the streak instead of breaking it', () => {
    expect(streak('2026-04-20', o(['2026-01', '2026-03', '2026-04'], ['2026-02']))).toBe(3)
  })
  it('a missed month breaks it', () => {
    expect(streak('2026-04-20', o(['2026-01', '2026-02', '2026-04']))).toBe(1)
  })
})
