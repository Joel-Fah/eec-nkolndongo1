import { describe, expect, it } from 'vitest'
import { formatDate, formatTime, formatXAF } from './format.ts'
import { pickLocale } from './locales.ts'
import { frTypo, NBSP, NNBSP } from './typography.ts'

describe('frTypo', () => {
  it('adds a narrow no-break space before ; ! ?', () => {
    expect(frTypo('Bienvenue!')).toBe(`Bienvenue${NNBSP}!`)
    expect(frTypo('Vraiment ?')).toBe(`Vraiment${NNBSP}?`)
    expect(frTypo('Quoi ?!')).toBe(`Quoi${NNBSP}?!`)
    expect(frTypo('un; deux')).toBe(`un${NNBSP}; deux`)
  })
  it('adds a no-break space before a colon', () => {
    expect(frTypo('Horaires : dimanche')).toBe(`Horaires${NBSP}: dimanche`)
  })
  it('handles guillemets and apostrophes', () => {
    expect(frTypo('« Paix »')).toBe(`«${NBSP}Paix${NBSP}»`)
    expect(frTypo("l'Église")).toBe('l’Église')
  })
  it('leaves URLs, times and query strings alone', () => {
    expect(frTypo('https://eec.cm/?q=1')).toBe('https://eec.cm/?q=1')
    expect(frTypo('09:00')).toBe('09:00')
  })
  it('is idempotent', () => {
    const once = frTypo('« Bonjour ! » : oui ?')
    expect(frTypo(once)).toBe(once)
  })
})

describe('formatters', () => {
  // 25 October 2026, 09:00 in Yaoundé (UTC+1)
  const sunday = new Date('2026-10-25T08:00:00Z')
  it('formats dates in French and English', () => {
    expect(formatDate(sunday, 'fr')).toBe('dimanche 25 octobre')
    expect(formatDate(sunday, 'en')).toBe('Sunday 25 October')
  })
  it('formats times on a 24-hour clock', () => {
    expect(formatTime(sunday, 'fr')).toBe('09h00')
    expect(formatTime(sunday, 'en')).toBe('09:00')
  })
  it('formats CFA francs', () => {
    expect(formatXAF(5000, 'fr')).toBe(`5${NNBSP}000${NBSP}FCFA`)
    expect(formatXAF(5000, 'en')).toBe(`5,000${NBSP}FCFA`)
  })
})

describe('pickLocale', () => {
  it('honours quality values and falls back to French', () => {
    expect(pickLocale('en-GB,en;q=0.9,fr;q=0.8')).toBe('en')
    expect(pickLocale('de-DE,fr;q=0.5,en;q=0.4')).toBe('fr')
    expect(pickLocale('de-DE')).toBe('fr')
    expect(pickLocale(null)).toBe('fr')
    expect(pickLocale('en;q=0, fr')).toBe('fr')
  })
})
