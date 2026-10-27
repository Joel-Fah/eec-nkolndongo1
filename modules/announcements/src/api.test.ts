import { describe, expect, it } from 'vitest'
import { itemBody } from './api.ts'

const ok = {
  groupId: '11111111-1111-4111-8111-111111111111',
  titleFr: 'Répétition déplacée',
  bodyFr: 'La répétition a lieu samedi.',
}

describe('announcement body', () => {
  it('accepts a short message with an optional link and last day', () => {
    expect(itemBody.safeParse(ok).success).toBe(true)
    expect(
      itemBody.safeParse({ ...ok, linkUrl: '/fr/agenda/', expiresOn: '2026-11-30' }).success,
    ).toBe(true)
    expect(itemBody.safeParse({ ...ok, linkUrl: 'https://example.org/x' }).success).toBe(true)
  })
  it('refuses a link that is not a site path or https, and a bad date', () => {
    expect(itemBody.safeParse({ ...ok, linkUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(itemBody.safeParse({ ...ok, linkUrl: 'http://example.org' }).success).toBe(false)
    expect(itemBody.safeParse({ ...ok, expiresOn: '30/11/2026' }).success).toBe(false)
  })
  it('refuses unknown fields and over-long text', () => {
    expect(itemBody.safeParse({ ...ok, extra: 1 }).success).toBe(false)
    expect(itemBody.safeParse({ ...ok, bodyFr: 'x'.repeat(1001) }).success).toBe(false)
  })
})
