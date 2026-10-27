import { describe, expect, it } from 'vitest'
import {
  GOOGLE_FRESH_MS,
  GOOGLE_INTENT_COOKIE,
  googleLinkIsFresh,
  googleVerdict,
  readIntent,
} from './auth.ts'

const cookie = (v: unknown) => `${GOOGLE_INTENT_COOKIE}=${encodeURIComponent(JSON.stringify(v))}`

describe('Google sign-in consent cookie', () => {
  it('reads the consent given on the page before the redirect', () => {
    const intent = readIntent(
      `a=b; ${cookie({ l: 'en', privacy: true, news: false, v: '2026-10' })}; c=d`,
    )
    expect(intent).toEqual({ l: 'en', privacy: true, news: false, v: '2026-10' })
  })

  it('returns nothing without the cookie, so a new account is refused', () => {
    expect(readIntent(null)).toBeNull()
    expect(readIntent('eec.session=abc')).toBeNull()
  })

  it('ignores garbage and unknown languages', () => {
    expect(readIntent(`${GOOGLE_INTENT_COOKIE}=%7Bnot-json`)).toBeNull()
    expect(readIntent(cookie({ l: 'de', privacy: true, news: false, v: 'x' }))).toBeNull()
  })

  it('keeps the admin origin of the sign-in, and nothing else for the origin', () => {
    expect(
      readIntent(cookie({ l: 'fr', privacy: false, news: false, v: 'x', a: 'admin' }))?.a,
    ).toBe('admin')
    expect(
      readIntent(cookie({ l: 'fr', privacy: false, news: false, v: 'x', a: 'root' }))?.a,
    ).toBeUndefined()
  })
})

describe('Google sign-in verdict (decision 0053)', () => {
  const base = {
    staff: false,
    freshLink: false,
    knownMember: true,
    fromAdmin: false,
    consent: false,
  }

  it('lets staff in with a link they made earlier (from their account, or as a member before the role)', () => {
    expect(googleVerdict({ ...base, staff: true })).toBe('ok')
    expect(googleVerdict({ ...base, staff: true, fromAdmin: true })).toBe('ok')
  })

  it('refuses staff when this very sign-in created the link by matching the e-mail', () => {
    expect(googleVerdict({ ...base, staff: true, freshLink: true })).toBe('staff')
    expect(googleVerdict({ ...base, staff: true, freshLink: true, fromAdmin: true })).toBe('staff')
  })

  it('lets only staff out of the admin page', () => {
    expect(googleVerdict({ ...base, fromAdmin: true })).toBe('notstaff')
    expect(googleVerdict({ ...base, fromAdmin: true, knownMember: false, consent: true })).toBe(
      'notstaff',
    )
  })

  it('keeps the member rules: a new member needs the consent ticked first', () => {
    expect(googleVerdict(base)).toBe('ok')
    expect(googleVerdict({ ...base, knownMember: false })).toBe('consent')
    expect(googleVerdict({ ...base, knownMember: false, consent: true })).toBe('ok')
  })

  it('tells a link made a moment ago from an earlier one', () => {
    const now = Date.now()
    expect(googleLinkIsFresh(new Date(now - 1000), now)).toBe(true)
    expect(googleLinkIsFresh(new Date(now - GOOGLE_FRESH_MS - 1), now)).toBe(false)
    expect(googleLinkIsFresh(new Date(now - 86_400_000), now)).toBe(false)
  })
})
