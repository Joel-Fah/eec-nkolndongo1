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
  it('slots: monthly rhythm and anchors are validated', () => {
    expect(slotBody.safeParse({ recurrence: { freq: 'monthly', nth: [2] } }).success).toBe(true)
    expect(slotBody.safeParse({ recurrence: { freq: 'monthly', nth: [5] } }).success).toBe(false)
    expect(slotBody.safeParse({ recurrence: { freq: 'weekly', interval: 2 } }).success).toBe(true)
    expect(
      slotBody.safeParse({ anchorSlotId: '11111111-1111-4111-8111-111111111111', offsetDays: -4 })
        .success,
    ).toBe(true)
    expect(slotBody.safeParse({ offsetDays: 40 }).success).toBe(false)
  })
  it('exceptions: a change needs a time, an extra needs a name and a time', () => {
    const date = '2026-11-01'
    expect(excBody.safeParse({ date, slotId: null, kind: 'cancelled' }).success).toBe(false) // a reason is required
    expect(
      excBody.safeParse({ date, slotId: null, kind: 'cancelled', noteFr: 'Fête nationale' })
        .success,
    ).toBe(true)
    expect(
      excBody.safeParse({
        date,
        slotId: '11111111-1111-4111-8111-111111111111',
        kind: 'moved',
        toDate: '2026-11-15',
        noteFr: 'Retraite',
      }).success,
    ).toBe(true)
    expect(
      excBody.safeParse({
        date,
        slotId: '11111111-1111-4111-8111-111111111111',
        kind: 'moved',
        toDate: date,
        noteFr: 'x',
      }).success,
    ).toBe(false)
    expect(
      excBody.safeParse({
        date,
        slotId: '11111111-1111-4111-8111-111111111111',
        kind: 'moved',
        noteFr: 'x',
      }).success,
    ).toBe(false)
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
    expect(
      excBody.safeParse({ date: 'demain', slotId: null, kind: 'cancelled', noteFr: 'x' }).success,
    ).toBe(false)
  })
})
