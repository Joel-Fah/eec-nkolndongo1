import { describe, expect, it } from 'vitest'
import { LIMITS, usageLevel, worst } from './health.ts'

describe('health levels', () => {
  it('warns from 70 % and fails from 90 % of a free limit', () => {
    expect(usageLevel(LIMITS.dbBytes * 0.69, LIMITS.dbBytes)).toBe('ok')
    expect(usageLevel(LIMITS.dbBytes * 0.7, LIMITS.dbBytes)).toBe('warn')
    expect(usageLevel(LIMITS.dbBytes * 0.9, LIMITS.dbBytes)).toBe('fail')
  })
  it('the row takes the worst check', () => {
    expect(worst(['ok', 'ok'])).toBe('ok')
    expect(worst(['ok', 'warn'])).toBe('warn')
    expect(worst(['warn', 'fail', 'ok'])).toBe('fail')
  })
})
