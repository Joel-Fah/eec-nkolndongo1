import { describe, expect, it } from 'vitest'
import { contributionBody, feeBody, proposeBody, stateOf, visaBody } from './api.ts'

describe('card state', () => {
  const day = '2026-11-10'
  it('is valid only while active and not past its last day', () => {
    expect(stateOf({ status: 'active', validUntil: '2026-12-31' }, day)).toBe('valid')
    expect(stateOf({ status: 'active', validUntil: '2026-11-09' }, day)).toBe('expired')
    expect(stateOf({ status: 'active', validUntil: '2026-11-10' }, day)).toBe('valid')
  })
  it('a suspended, withdrawn or proposed card is never valid, whatever its date', () => {
    expect(stateOf({ status: 'suspended', validUntil: '2030-01-01' }, day)).toBe('suspended')
    expect(stateOf({ status: 'withdrawn', validUntil: '2030-01-01' }, day)).toBe('withdrawn')
    expect(stateOf({ status: 'proposed', validUntil: '2030-01-01' }, day)).toBe('proposed')
  })
})

describe('bodies', () => {
  it('a visa is for a YYYY-MM month and nothing else', () => {
    expect(visaBody.safeParse({ month: '2026-11', signed: true }).success).toBe(true)
    expect(visaBody.safeParse({ month: '2026-13', signed: true }).success).toBe(false)
    expect(visaBody.safeParse({ month: '2026-11', signed: true, extra: 1 }).success).toBe(false)
  })
  it('amounts are whole, not negative, and can be cleared', () => {
    expect(contributionBody.safeParse({ month: '2026-11', amountXaf: 5000 }).success).toBe(true)
    expect(contributionBody.safeParse({ month: '2026-11', amountXaf: null }).success).toBe(true)
    expect(contributionBody.safeParse({ month: '2026-11', amountXaf: -1 }).success).toBe(false)
    expect(contributionBody.safeParse({ month: '2026-11', amountXaf: 1.5 }).success).toBe(false)
    expect(feeBody.safeParse({ kind: 'age', key: '18-25', amountXaf: 2000 }).success).toBe(true)
    expect(feeBody.safeParse({ kind: 'other', key: 'x', amountXaf: 1 }).success).toBe(false)
  })
  it('proposing needs a person, the end of validity is optional', () => {
    expect(proposeBody.safeParse({ userId: '11111111-1111-4111-8111-111111111111' }).success).toBe(
      true,
    )
    expect(proposeBody.safeParse({ userId: 'x' }).success).toBe(false)
  })
})
