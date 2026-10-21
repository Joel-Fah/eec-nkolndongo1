import { describe, expect, it } from 'vitest'
import { sundayBody, verseBody } from './api.ts'

describe('liturgy input', () => {
  it('cleans readings and refuses bad references', () => {
    const ok = sundayBody.safeParse({ readings: [{ book: 'jhn', chapter: 3, from: 16 }] })
    expect(ok.success && ok.data.readings).toEqual([
      { book: 'jhn', chapter: 3, from: 16, to: null },
    ])
    expect(sundayBody.safeParse({ readings: [{ book: 'xxx', chapter: 1 }] }).success).toBe(false)
    expect(
      sundayBody.safeParse({
        readings: Array.from({ length: 7 }, () => ({ book: 'jhn', chapter: 1 })),
      }).success,
    ).toBe(false)
  })
  it('never lets the state or the consent proof be set directly', () => {
    expect(sundayBody.safeParse({ state: 'published' }).success).toBe(false)
    expect(sundayBody.safeParse({ namesConfirmedBy: 'someone' }).success).toBe(false)
    expect(sundayBody.safeParse({ namesConsent: true }).success).toBe(true)
  })
  it('verses: a season must be a known one, a date must be a date', () => {
    expect(verseBody.safeParse({ season: 'avent' }).success).toBe(true)
    expect(verseBody.safeParse({ season: 'printemps' }).success).toBe(false)
    expect(verseBody.safeParse({ onDate: '2026-12-25' }).success).toBe(true)
    expect(verseBody.safeParse({ onDate: 'noël' }).success).toBe(false)
  })
})
