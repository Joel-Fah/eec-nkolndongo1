import { describe, expect, it } from 'vitest'
import { dueSundays, pastSundays, weekOf } from './reminders.ts'

describe('reminders', () => {
  it('groups by the Monday of the week', () => {
    expect(weekOf('2026-10-25')).toBe('2026-10-19')
    expect(weekOf('2026-10-19')).toBe('2026-10-19')
    expect(weekOf('2026-10-26')).toBe('2026-10-26')
  })
  it('lists the Sundays before today, newest first', () => {
    expect(pastSundays('2026-10-27', 3)).toEqual(['2026-10-25', '2026-10-18', '2026-10-11'])
    expect(pastSundays('2026-10-25', 2)).toEqual(['2026-10-18', '2026-10-11'])
  })
  it('asks only for what the person may enter, and not for closed Sundays', () => {
    const done = new Map([
      ['2026-10-18', { attendance: true, offerings: false, closed: false }],
      ['2026-10-11', { attendance: false, offerings: false, closed: true }],
    ])
    const days = ['2026-10-25', '2026-10-18', '2026-10-11']
    expect(dueSundays(days, done, { attendance: true, offerings: true })).toEqual([
      { date: '2026-10-25', what: 'both' },
      { date: '2026-10-18', what: 'offerings' },
    ])
    expect(dueSundays(days, done, { attendance: true, offerings: false })).toEqual([
      { date: '2026-10-25', what: 'attendance' },
    ])
    expect(dueSundays(days, done, { attendance: false, offerings: false })).toEqual([])
  })
})
