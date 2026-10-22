import { describe, expect, it } from 'vitest'
import { nextSundays } from './todo.ts'

describe('nextSundays', () => {
  it('counts today when it is a Sunday', () => {
    expect(nextSundays(new Date('2026-10-25T09:00:00Z'), 2)).toEqual(['2026-10-25', '2026-11-01'])
  })
  it('otherwise the coming Sunday and the three after', () => {
    expect(nextSundays(new Date('2026-10-22T12:00:00Z'), 4)).toEqual([
      '2026-10-25',
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
    ])
  })
})
