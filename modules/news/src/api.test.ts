import { can, type Principal } from '@eec/auth'
import { describe, expect, it } from 'vitest'
import { patchSchema } from './api.ts'
import { newsModule } from './index.ts'

describe('news patch', () => {
  it('cleans documents on the way in', () => {
    const r = patchSchema.parse({
      bodyFr: {
        type: 'doc',
        content: [
          { type: 'script', content: [{ type: 'text', text: 'x' }] },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'ok',
                marks: [{ type: 'link', attrs: { href: 'javascript:1' } }],
              },
            ],
          },
        ],
      },
    })
    expect(JSON.stringify(r.bodyFr)).not.toMatch(/script|javascript/)
  })
  it('refuses unknown fields (no mass assignment of state, author, dates)', () => {
    expect(patchSchema.safeParse({ state: 'published' }).success).toBe(false)
    expect(patchSchema.safeParse({ createdBy: 'x' }).success).toBe(false)
    expect(patchSchema.safeParse({ titleFr: 'x'.repeat(201) }).success).toBe(false)
    expect(patchSchema.safeParse({ coverMediaId: 'not-a-uuid' }).success).toBe(false)
  })
})

describe('news rights are per group', () => {
  const jape = '11111111-1111-4111-8111-111111111111'
  const ufc = '22222222-2222-4222-8222-222222222222'
  const leader = (groupId: string): Principal => ({
    userId: 'u',
    status: 'active',
    isSuperAdmin: false,
    grants: [{ roleKey: 'responsable-groupe', groupId, permissions: new Set(['news:edit']) }],
  })
  it('a group leader edits their own group only', () => {
    expect(can(leader(jape), 'news:edit', { groupId: jape })).toBe(true)
    expect(can(leader(jape), 'news:edit', { groupId: ufc })).toBe(false)
    expect(can(leader(jape), 'news:edit', { groupId: null })).toBe(false)
  })
  it('has no publish right unless granted', () => {
    expect(can(leader(jape), 'news:publish', { groupId: jape })).toBe(false)
  })
  it('declares the module as group-scoped with its four rights', () => {
    expect(newsModule.scopedByGroup).toBe(true)
    expect(newsModule.permissionKeys).toEqual([
      'news:read',
      'news:edit',
      'news:publish',
      'news:delete',
    ])
  })
})
