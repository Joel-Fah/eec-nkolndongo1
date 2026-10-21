import { describe, expect, it } from 'vitest'
import { GOOGLE_INTENT_COOKIE, readIntent } from './auth.ts'

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
})
