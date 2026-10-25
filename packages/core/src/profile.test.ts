import { describe, expect, it } from 'vitest'
import {
  ageBand,
  ageOn,
  avatarSeed,
  emptyDetails,
  memberCode,
  profileCompleteness,
  validBirthDate,
} from './profile.ts'

const full = {
  birthDate: '1990-05-01',
  gender: 'woman',
  neighbourhood: 'Nkolndongo',
  city: 'Yaoundé',
  maritalStatus: 'married',
  profession: 'Enseignante',
} as const

describe('profile', () => {
  it('knows a valid birth date', () => {
    expect(validBirthDate('1990-05-01', '2026-10-25')).toBe(true)
    expect(validBirthDate('2030-01-01', '2026-10-25')).toBe(false)
    expect(validBirthDate('1890-01-01', '2026-10-25')).toBe(false)
    expect(validBirthDate('1990-02-30', '2026-10-25')).toBe(false)
  })
  it('works out an age and its band', () => {
    expect(ageOn('2000-10-26', '2026-10-25')).toBe(25)
    expect(ageOn('2000-10-25', '2026-10-25')).toBe(26)
    expect(ageBand('2012-01-01', '2026-10-25')).toBe('under18')
    expect(ageBand('2000-10-26', '2026-10-25')).toBe('18-25')
    expect(ageBand('1990-05-01', '2026-10-25')).toBe('36-50')
    expect(ageBand('1950-05-01', '2026-10-25')).toBe('over65')
    expect(ageBand(null, '2026-10-25')).toBeNull()
  })
  it('says what is left to do', () => {
    expect(profileCompleteness(null, false, false).complete).toBe(false)
    const some = profileCompleteness({ ...emptyDetails(), city: 'Yaoundé' }, true, false)
    expect(some.filled).toBe(1)
    expect(some.complete).toBe(false)
    const done = profileCompleteness(full, true, false)
    expect(done.complete).toBe(true)
    // The photo is only ever suggested.
    expect(done.steps.find((s) => s.key === 'photo')?.optional).toBe(true)
    // Details without consent never count.
    expect(profileCompleteness(full, false, true).complete).toBe(false)
  })
  it('makes a stable member code that is not a sequence', () => {
    const a = memberCode('3f2c8f6e-1b7a-4d1c-9a55-0d6f0e2b8c11')
    expect(a).toMatch(/^EEC-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(memberCode('3f2c8f6e-1b7a-4d1c-9a55-0d6f0e2b8c11')).toBe(a)
    expect(memberCode('3f2c8f6e-1b7a-4d1c-9a55-0d6f0e2b8c12')).not.toBe(a)
  })
  it('seeds the avatar the same way every time', () => {
    expect(avatarSeed('abc')).toBe(avatarSeed('abc'))
    expect(avatarSeed('abc')).not.toBe(avatarSeed('abd'))
  })
})
