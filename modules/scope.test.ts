/**
 * Rights and scope (Phase 04 quality gate): a right granted for one group is never a right for another group or for the whole
 * parish, for every module that can be scoped (and the ones that cannot); and the Moissons roles keep entering and validating apart.
 */
import { can, type Principal } from '@eec/auth'
import { systemRoles } from '@eec/auth/core-module'
import { describe, expect, it } from 'vitest'
import { modules } from './registry.ts'

const A = 'group-a'
const B = 'group-b'
const scoped = (permissions: string[], groupId: string | null): Principal => ({
  userId: 'u',
  status: 'active',
  isSuperAdmin: false,
  grants: [{ roleKey: 'responsable-groupe', groupId, permissions: new Set(permissions) }],
})

describe('a right for one group stays in that group', () => {
  for (const m of modules.filter((x) => x.id !== 'core')) {
    const keys = m.permissions.map((p) => `${m.id}:${p.action}`)
    it(`${m.id}: ${m.scopedByGroup ? 'group-scoped' : 'parish-wide'} — a grant for group A does not open group B or the parish`, () => {
      const p = scoped(keys, A)
      for (const k of keys) {
        expect(can(p, k, { groupId: A }), `${k} on A`).toBe(true)
        expect(can(p, k, { groupId: B }), `${k} on B`).toBe(false)
        expect(can(p, k, { groupId: null }), `${k} on the parish`).toBe(false)
        expect(can(p, k), `${k} without a group`).toBe(false)
      }
    })
    it(`${m.id}: a parish-wide grant works everywhere`, () => {
      const p = scoped(keys, null)
      for (const k of keys) expect(can(p, k, { groupId: B }), k).toBe(true)
    })
  }
})

describe('system roles', () => {
  it('every grant in code is a permission some manifest declares (the seed would drop it silently)', () => {
    const known = new Set(modules.flatMap((m) => m.permissions.map((p) => `${m.id}:${p.action}`)))
    for (const r of systemRoles)
      for (const g of r.grants) expect(known.has(g), `${r.key} grants ${g}`).toBe(true)
  })
})

describe('the Moissons roles', () => {
  const grants = (key: string) => new Set(systemRoles.find((r) => r.key === key)?.grants ?? [])
  const as = (key: string): Principal => ({
    userId: 'u',
    status: 'active',
    isSuperAdmin: false,
    grants: [{ roleKey: key, groupId: null, permissions: grants(key) }],
  })
  it('the treasurer enters but cannot validate or define campaigns', () => {
    const p = as('tresorier')
    expect(can(p, 'campaigns:progress')).toBe(true)
    expect(can(p, 'campaigns:validate')).toBe(false)
    expect(can(p, 'campaigns:edit')).toBe(false)
  })
  it('the secretariat validates and defines but cannot enter amounts', () => {
    const p = as('secretariat')
    expect(can(p, 'campaigns:validate')).toBe(true)
    expect(can(p, 'campaigns:edit')).toBe(true)
    expect(can(p, 'campaigns:progress')).toBe(false)
  })
  it('the CSV export of registrations is for the secretariat only, never the group leader or the editor', () => {
    expect(can(as('secretariat'), 'registrations:export')).toBe(true)
    for (const key of ['responsable-groupe', 'editeur', 'tresorier', 'validateur'])
      expect(can(as(key), 'registrations:export'), key).toBe(false)
  })
})

describe('the group space (decision 0049)', () => {
  const leader = (groupId: string | null): Principal => ({
    userId: 'u',
    status: 'active',
    isSuperAdmin: false,
    grants: [
      {
        roleKey: 'responsable-groupe',
        groupId,
        permissions: new Set(systemRoles.find((r) => r.key === 'responsable-groupe')?.grants ?? []),
      },
    ],
  })
  it('a leader sees and manages their own group only, and cannot export', () => {
    const p = leader(A)
    for (const k of ['core:group-roster', 'core:group-members'])
      expect(can(p, k, { groupId: A }), `${k} on A`).toBe(true)
    for (const k of ['core:group-roster', 'core:group-members']) {
      expect(can(p, k, { groupId: B }), `${k} on B`).toBe(false)
      expect(can(p, k, { groupId: null }), `${k} on the parish`).toBe(false)
    }
    expect(can(p, 'core:group-export', { groupId: A })).toBe(false)
  })
  it('a leader of one group never writes announcements for another', () => {
    const p = leader(A)
    expect(can(p, 'announcements:publish', { groupId: A })).toBe(true)
    expect(can(p, 'announcements:publish', { groupId: B })).toBe(false)
  })
})
