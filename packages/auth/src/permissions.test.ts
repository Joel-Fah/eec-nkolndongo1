import { describe, expect, it } from 'vitest'
import { can, canAnywhere, type Principal, scopeFor } from './permissions.ts'

const leader: Principal = {
  userId: 'u1',
  status: 'active',
  isSuperAdmin: false,
  grants: [
    { roleKey: 'responsable-groupe', groupId: 'g1', permissions: new Set(['core:group-space']) },
  ],
}

describe('rights of a staff member who has no password yet (decision 0053)', () => {
  it('keeps their rights once they have a password', () => {
    expect(can(leader, 'core:group-space', { groupId: 'g1' })).toBe(true)
    expect(canAnywhere(leader, 'core:group-space')).toBe(true)
    expect(scopeFor(leader, 'core:group-space')).toEqual(['g1'])
  })

  it('suspends every right, even a super admin’s, until a password is set', () => {
    const waiting: Principal = { ...leader, needsPassword: true }
    expect(can(waiting, 'core:group-space', { groupId: 'g1' })).toBe(false)
    expect(canAnywhere(waiting, 'core:group-space')).toBe(false)
    expect(scopeFor(waiting, 'core:group-space')).toEqual([])
    expect(can({ ...waiting, isSuperAdmin: true }, 'core:users-read')).toBe(false)
  })
})
