import { describe, expect, it } from 'vitest'
import { daysLeft, normalizePhone, purgeOn, retentionLevel } from './registration.ts'

describe('phone numbers', () => {
  it('reads a Cameroon number with or without the code', () => {
    for (const raw of [
      '677123456',
      '6 77 12 34 56',
      '677.12.34.56',
      '+237 677 12 34 56',
      '+237677123456',
      '00237677123456',
      '237677123456',
      '(237) 677-123-456',
    ])
      expect(normalizePhone(raw)?.e164, raw).toBe('+237677123456')
    expect(normalizePhone('222123456')?.e164).toBe('+237222123456')
    expect(normalizePhone('677123456')?.display).toBe('+237 6 77 12 34 56')
  })
  it('keeps another country only with its +', () => {
    expect(normalizePhone('+33 6 12 34 56 78')?.e164).toBe('+33612345678')
    expect(normalizePhone('0612345678')).toBeNull()
  })
  it('refuses what is not a number', () => {
    for (const raw of ['', '12', 'abc', '67712345', '5771234567', '+0123456', '677 123 456 789'])
      expect(normalizePhone(raw), raw).toBeNull()
  })
})

describe('how long a registration is kept', () => {
  it('is 6 months after the event, capped at 12 months after the form closed', () => {
    expect(purgeOn('2026-11-14')).toBe('2027-05-14')
    expect(purgeOn('2026-08-31')).toBe('2027-02-28')
    expect(purgeOn('2026-11-14', new Date('2026-11-10T00:00:00Z'))).toBe('2027-05-14')
    expect(purgeOn('2027-12-01', new Date('2026-11-10T00:00:00Z'))).toBe('2027-11-10')
  })
  it('counts the days left and colours them', () => {
    const now = new Date('2026-10-23T15:00:00Z')
    expect(daysLeft('2026-10-23', now)).toBe(0)
    expect(daysLeft('2026-11-22', now)).toBe(30)
    expect(daysLeft('2026-10-20', now)).toBe(-3)
    expect(retentionLevel(120)).toBe('calm')
    expect(retentionLevel(61)).toBe('calm')
    expect(retentionLevel(60)).toBe('warning')
    expect(retentionLevel(15)).toBe('warning')
    expect(retentionLevel(14)).toBe('critical')
    expect(retentionLevel(0)).toBe('critical')
  })
})
