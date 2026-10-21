import { describe, expect, it } from 'vitest'
import { BOOKS, cleanRef, formatRef } from './bible.ts'

describe('bible references', () => {
  it('has 66 books with unique ids', () => {
    expect(BOOKS.length).toBe(66)
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(66)
  })
  it('formats per language (French spacing around the colon)', () => {
    expect(formatRef({ book: 'mat', chapter: 11, from: 28 }, 'fr')).toBe('Matthieu 11 : 28')
    expect(formatRef({ book: 'mat', chapter: 11, from: 28, to: 30 }, 'en')).toBe('Matthew 11:28–30')
    expect(formatRef({ book: 'psa', chapter: 23 }, 'fr')).toBe('Psaumes 23')
  })
  it('cleans what was typed', () => {
    expect(cleanRef({ book: 'jhn', chapter: 3, from: 16 })).toEqual({
      book: 'jhn',
      chapter: 3,
      from: 16,
      to: null,
    })
    expect(cleanRef({ book: 'xxx', chapter: 3 })).toBeNull()
    expect(cleanRef({ book: 'jhn', chapter: 0 })).toBeNull()
    expect(cleanRef({ book: 'jhn', chapter: 3, from: 16, to: 10 })).toBeNull()
    expect(cleanRef({ book: 'jhn', chapter: 3, to: 5 })).toBeNull()
    expect(cleanRef(null)).toBeNull()
  })
})
