import { can, scopeFor } from '@eec/auth'
import { describe, expect, it } from 'vitest'
import { pageBody, personBody, quizBody } from './api.ts'

describe('departments input', () => {
  it('a page accepts known tags only and refuses unknown fields', () => {
    expect(pageBody.safeParse({ tags: ['jeunes', 'musique'] }).success).toBe(true)
    expect(pageBody.safeParse({ tags: ['inconnu'] }).success).toBe(false)
    expect(pageBody.safeParse({ state: 'published' }).success).toBe(false) // publishing has its own route
  })
  it('a person needs a name; consent cannot be forged from the client (who/when are server-side)', () => {
    expect(personBody.safeParse({ name: 'A', publicConsent: true }).success).toBe(true)
    expect(personBody.safeParse({ name: '' }).success).toBe(false)
    expect(personBody.safeParse({ name: 'A', consentBy: 'x' }).success).toBe(false)
    expect(personBody.safeParse({ name: 'A', consentAt: '2026-01-01' }).success).toBe(false)
  })
  it('the quiz needs 2+ answers per question, each with a tag', () => {
    const q = (answers: unknown[]) => ({
      questions: [{ id: 'q1', textFr: 'Q', textEn: '', answers }],
    })
    const a = { id: 'a', textFr: 'A', textEn: '', tags: ['jeunes'] }
    expect(quizBody.safeParse(q([a, { ...a, id: 'b' }])).success).toBe(true)
    expect(quizBody.safeParse(q([a])).success).toBe(false)
    expect(quizBody.safeParse(q([a, { ...a, id: 'b', tags: [] }])).success).toBe(false)
  })
})

describe('departments scoped rights (a leader of one group cannot touch another)', () => {
  const JAPE = '11111111-1111-4111-8111-111111111111'
  const UFC = '22222222-2222-4222-8222-222222222222'
  const leader = {
    userId: 'u1',
    status: 'active' as const,
    isSuperAdmin: false,
    grants: [
      {
        roleKey: 'responsable',
        groupId: JAPE,
        permissions: new Set(['departments:update', 'departments:read']),
      },
    ],
  }
  it('may edit their own group only', () => {
    expect(can(leader, 'departments:update', { groupId: JAPE })).toBe(true)
    expect(can(leader, 'departments:update', { groupId: UFC })).toBe(false)
    expect(can(leader, 'departments:quiz')).toBe(false)
  })
  it('lists only their own group', () => {
    expect(scopeFor(leader, 'departments:read')).toEqual([JAPE])
  })
})
