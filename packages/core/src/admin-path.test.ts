import { describe, expect, it } from 'vitest'
import { adminBase, adminPrefix, normalizeAdminPath } from './admin-path.ts'

describe('ADMIN_PATH', () => {
  it('defaults to admin', () => {
    expect(normalizeAdminPath(undefined)).toBe('admin')
    expect(normalizeAdminPath('')).toBe('admin')
    expect(normalizeAdminPath('  /  ')).toBe('admin')
  })

  it.each(['gestion', 'gestion/', '/gestion', '/gestion/', ' Gestion ', '//gestion//'])(
    'accepts %j as the same place',
    (raw) => {
      expect(normalizeAdminPath(raw)).toBe('gestion')
      expect(adminPrefix(raw)).toBe('/gestion')
      expect(adminBase(raw)).toBe('/gestion/')
    },
  )

  it('supports nested paths', () => {
    expect(adminBase('/equipe/acces/')).toBe('/equipe/acces/')
  })

  it('refuses unsafe or reserved values', () => {
    expect(() => normalizeAdminPath('ad min')).toThrow()
    expect(() => normalizeAdminPath('../etc')).toThrow()
    expect(() => normalizeAdminPath('a?b')).toThrow()
    expect(() => normalizeAdminPath('/api/')).toThrow(/reserved/)
    expect(() => normalizeAdminPath('fr')).toThrow(/reserved/)
  })
})
