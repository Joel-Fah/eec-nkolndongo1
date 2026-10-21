import { describe, expect, it } from 'vitest'
import { MEMBER_MS, STAFF_IDLE_MS, STAFF_MAX_MS, sessionExpiry } from './sessions.ts'

describe('session lifetime', () => {
  const t0 = Date.parse('2026-10-19T08:00:00Z')
  it('members get 30 days', () => {
    expect(sessionExpiry({ staff: false, createdAt: new Date(t0), now: t0 }).getTime()).toBe(
      t0 + MEMBER_MS,
    )
  })
  it('staff get 12 h idle', () => {
    expect(
      sessionExpiry({ staff: true, createdAt: new Date(t0), now: t0 + 3_600_000 }).getTime(),
    ).toBe(t0 + 3_600_000 + STAFF_IDLE_MS)
  })
  it('staff are capped at 7 days from sign-in, however active', () => {
    const late = t0 + STAFF_MAX_MS - 3_600_000
    expect(sessionExpiry({ staff: true, createdAt: new Date(t0), now: late }).getTime()).toBe(
      t0 + STAFF_MAX_MS,
    )
  })
})
