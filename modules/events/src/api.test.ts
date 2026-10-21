import { describe, expect, it } from 'vitest'
import { patchSchema } from './api.ts'

describe('events patch', () => {
  it('accepts the three repeat shapes and rejects nonsense', () => {
    expect(
      patchSchema.safeParse({ recurrence: { freq: 'weekly', byDay: [0], count: 4 } }).success,
    ).toBe(true)
    expect(
      patchSchema.safeParse({
        recurrence: { freq: 'monthly', mode: 'nthWeekday', nth: -1, weekday: 0 },
      }).success,
    ).toBe(true)
    expect(
      patchSchema.safeParse({
        recurrence: { freq: 'monthly', mode: 'monthday', day: 15, until: '2027-01-01' },
      }).success,
    ).toBe(true)
    expect(patchSchema.safeParse({ recurrence: { freq: 'weekly', byDay: [] } }).success).toBe(false)
    expect(patchSchema.safeParse({ recurrence: { freq: 'daily' } }).success).toBe(false)
    expect(
      patchSchema.safeParse({ recurrence: { freq: 'monthly', mode: 'monthday', day: 40 } }).success,
    ).toBe(false)
    expect(patchSchema.safeParse({ recurrence: null }).success).toBe(true)
  })
  it('validates dates, zone, link and unknown fields', () => {
    expect(patchSchema.safeParse({ startsAt: '2026-11-01T08:00:00Z' }).success).toBe(true)
    expect(patchSchema.safeParse({ startsAt: 'tomorrow' }).success).toBe(false)
    expect(patchSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false)
    expect(patchSchema.safeParse({ timezone: 'Africa/Douala' }).success).toBe(true)
    expect(patchSchema.safeParse({ registrationUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(patchSchema.safeParse({ registrationUrl: 'http://x.org' }).success).toBe(false)
    expect(patchSchema.safeParse({ registrationUrl: 'https://x.org/inscription' }).success).toBe(
      true,
    )
    expect(patchSchema.safeParse({ state: 'published' }).success).toBe(false)
  })
  it('cleans the description', () => {
    const r = patchSchema.parse({ descriptionFr: { type: 'doc', content: [{ type: 'script' }] } })
    expect(r.descriptionFr).toEqual({ type: 'doc', content: [] })
  })
})
