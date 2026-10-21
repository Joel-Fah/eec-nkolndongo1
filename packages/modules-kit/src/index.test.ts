import { describe, expect, it } from 'vitest'
import { defineModule, isModuleEnabled, splitPermission } from './index.ts'

const base = { label: { fr: 'Essai', en: 'Test' }, toggleable: true, flagDefault: true }

describe('defineModule', () => {
  it('builds full permission keys', () => {
    const m = defineModule({
      ...base,
      id: 'events',
      permissions: [{ action: 'publish', label: { fr: 'Publier', en: 'Publish' } }],
    })
    expect(m.permissionKeys).toEqual(['events:publish'])
  })
  it('rejects bad ids and duplicate actions', () => {
    expect(() => defineModule({ ...base, id: 'Bad Id', permissions: [] })).toThrow()
    const p = { action: 'read', label: { fr: 'Lire', en: 'Read' } }
    expect(() => defineModule({ ...base, id: 'x', permissions: [p, p] })).toThrow(/duplicate/)
  })
  it('requires nav entries to use the module’s own permissions', () => {
    expect(() =>
      defineModule({
        ...base,
        id: 'media',
        permissions: [],
        admin: {
          nav: [
            {
              group: 'content',
              label: { fr: 'a', en: 'a' },
              path: '/m',
              icon: 'book',
              order: 1,
              permission: 'news:read',
            },
          ],
        },
      }),
    ).toThrow(/own permissions/)
  })
})

describe('flags', () => {
  const m = defineModule({ ...base, id: 'media', permissions: [] })
  it('uses the manifest default, then the stored flag; core modules are always on', () => {
    expect(isModuleEnabled(m, new Map())).toBe(true)
    expect(isModuleEnabled(m, new Map([['media', false]]))).toBe(false)
    expect(isModuleEnabled({ ...m, toggleable: false }, new Map([['media', false]]))).toBe(true)
  })
  it('splits permission keys', () => {
    expect(splitPermission('events:publish')).toEqual({ module: 'events', action: 'publish' })
  })
})
