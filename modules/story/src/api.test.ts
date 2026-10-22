import { PAGE_SLOTS } from '@eec/core'
import { describe, expect, it } from 'vitest'
import { councilBody, milestoneBody, slotBody } from './api.ts'

describe('pages input', () => {
  it('slots accept text and rich bodies, refuse unknown fields (state has its own route)', () => {
    expect(slotBody.safeParse({ valueFr: 'Bonjour' }).success).toBe(true)
    expect(slotBody.safeParse({ state: 'published' }).success).toBe(false)
  })
  it('milestones are bounded', () => {
    expect(milestoneBody.safeParse({ year: '1957', titleFr: 'x' }).success).toBe(true)
    expect(milestoneBody.safeParse({ textFr: 'x'.repeat(801) }).success).toBe(false)
  })
  it('the council needs a name and a known role; consent is not client-writable', () => {
    expect(councilBody.safeParse({ name: 'A', roleKey: 'anciens' }).success).toBe(true)
    expect(councilBody.safeParse({ name: 'A', roleKey: 'roi' }).success).toBe(false)
    expect(councilBody.safeParse({ name: 'A', roleKey: 'anciens', consentBy: 'x' }).success).toBe(
      false,
    )
  })
  it('every declared slot has a key, a label and help in both languages', () => {
    for (const [page, def] of Object.entries(PAGE_SLOTS)) {
      expect(def.label.fr && def.label.en && def.path.fr && def.path.en).toBeTruthy()
      for (const s of def.slots) {
        expect(`${page}.${s.key}`).toMatch(/^[a-z]+\.[a-z_]+$/)
        expect(s.label.fr && s.label.en && s.help.fr && s.help.en).toBeTruthy()
      }
    }
  })
})
