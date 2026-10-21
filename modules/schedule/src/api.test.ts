import { describe, expect, it } from 'vitest'
import { excBody, slotBody } from './api.ts'

describe('schedule input', () => {
  it('accepts a slot and refuses bad times, days and unknown fields', () => {
    expect(
      slotBody.safeParse({ labelFr: 'Culte', weekday: 0, startTime: '09:00', endTime: null })
        .success,
    ).toBe(true)
    expect(slotBody.safeParse({ startTime: '9h' }).success).toBe(false)
    expect(slotBody.safeParse({ weekday: 7 }).success).toBe(false)
    expect(slotBody.safeParse({ validated: true }).success).toBe(false)
  })
  it('exceptions: a change needs a time, an extra needs a name and a time', () => {
    const date = '2026-11-01'
    expect(excBody.safeParse({ date, slotId: null, kind: 'cancelled' }).success).toBe(true)
    expect(excBody.safeParse({ date, slotId: null, kind: 'changed' }).success).toBe(false)
    expect(
      excBody.safeParse({ date, slotId: null, kind: 'changed', startTime: '16:00' }).success,
    ).toBe(true)
    expect(
      excBody.safeParse({ date, slotId: null, kind: 'extra', startTime: '19:00' }).success,
    ).toBe(false)
    expect(
      excBody.safeParse({
        date,
        slotId: null,
        kind: 'extra',
        startTime: '19:00',
        labelFr: 'Veillée',
      }).success,
    ).toBe(true)
    expect(excBody.safeParse({ date: 'demain', slotId: null, kind: 'cancelled' }).success).toBe(
      false,
    )
  })
})
