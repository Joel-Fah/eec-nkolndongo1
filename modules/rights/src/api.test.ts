import { describe, expect, it } from 'vitest'
import { addDays, createBody, patchBody, urgency } from './api.ts'

describe('data-rights log', () => {
  it('the deadline is counted from the day received', () => {
    expect(addDays('2026-11-02', 30)).toBe('2026-12-02')
  })
  it('an open request is overdue past its date, soon within five days, closed once done or refused', () => {
    expect(urgency({ status: 'received', dueOn: '2026-11-01' }, '2026-11-02')).toBe('overdue')
    expect(urgency({ status: 'in_progress', dueOn: '2026-11-06' }, '2026-11-02')).toBe('soon')
    expect(urgency({ status: 'received', dueOn: '2026-12-01' }, '2026-11-02')).toBe('open')
    expect(urgency({ status: 'done', dueOn: '2026-10-01' }, '2026-11-02')).toBe('closed')
  })
  it('a request needs a kind, a name and a channel, and nothing else is accepted', () => {
    expect(
      createBody.safeParse({ kind: 'erasure', name: 'Marie N.', channel: 'phone' }).success,
    ).toBe(true)
    expect(createBody.safeParse({ kind: 'sell', name: 'x', channel: 'phone' }).success).toBe(false)
    expect(
      createBody.safeParse({ kind: 'access', name: 'Marie', channel: 'phone', extra: 1 }).success,
    ).toBe(false)
    expect(patchBody.safeParse({ status: 'done', outcome: 'Copie remise' }).success).toBe(true)
    expect(patchBody.safeParse({ status: 'lost' }).success).toBe(false)
  })
})
