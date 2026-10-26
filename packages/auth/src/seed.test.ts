import { describe, expect, it } from 'vitest'
import { missingGrants } from './seed.ts'

const known = new Set(['a:read', 'a:edit', 'b:read'])

describe('missingGrants (decision 0048)', () => {
  it('offers every grant of a new role', () => {
    expect(missingGrants(['a:read', 'b:read'], new Set(), known)).toEqual(['a:read', 'b:read'])
  })
  it('offers only what was never offered: a second seed changes nothing', () => {
    const offered = new Set(['a:read', 'b:read'])
    expect(missingGrants(['a:read', 'b:read'], offered, known)).toEqual([])
  })
  it('offers a permission added to the code later', () => {
    expect(missingGrants(['a:read', 'a:edit'], new Set(['a:read']), known)).toEqual(['a:edit'])
  })
  it('never brings back a grant that was offered and then removed by hand', () => {
    // « a:read » was offered once (it is in the ledger) and someone removed it in Rôles: it stays removed.
    expect(missingGrants(['a:read'], new Set(['a:read']), known)).toEqual([])
  })
  it('ignores keys no manifest declares, and duplicates', () => {
    expect(missingGrants(['zzz:gone', 'a:read', 'a:read'], new Set(), known)).toEqual(['a:read'])
  })
})
