import { describe, expect, it } from 'vitest'
import {
  availability,
  cancelLinkSeconds,
  checkAnswers,
  csvCell,
  looksSensitive,
  newCode,
  placeFor,
  spotsLeft,
} from './rules.ts'
import type { FormField } from './schema.ts'

const base = {
  state: 'published',
  opensAt: null,
  closesAt: null,
  capacity: 10,
  waitlist: true,
  eventDate: '2026-11-14',
}
const now = new Date('2026-10-23T10:00:00Z')

describe('is the form open', () => {
  it('follows state, dates and capacity', () => {
    expect(availability({ ...base, state: 'draft' }, 0, now)).toBe('draft')
    expect(availability({ ...base, opensAt: new Date('2026-11-01T00:00:00Z') }, 0, now)).toBe(
      'not_yet',
    )
    expect(availability({ ...base, closesAt: new Date('2026-10-20T00:00:00Z') }, 0, now)).toBe(
      'closed',
    )
    expect(availability(base, 0, new Date('2026-11-16T00:00:00Z'))).toBe('closed')
    expect(availability(base, 10, now)).toBe('open') // a waitlist keeps it open
    expect(availability({ ...base, waitlist: false }, 10, now)).toBe('full')
    expect(availability({ ...base, capacity: null }, 999, now)).toBe('open')
  })
  it('puts a party where it fits', () => {
    expect(placeFor(10, 8, 2, true)).toBe('confirmed')
    expect(placeFor(10, 8, 3, true)).toBe('waitlist')
    expect(placeFor(10, 8, 3, false)).toBeNull()
    expect(placeFor(null, 500, 4, false)).toBe('confirmed')
    expect(spotsLeft(10, 12)).toBe(0)
    expect(spotsLeft(null, 3)).toBeNull()
  })
  it('keeps a cancel link alive past the event, at least a day', () => {
    expect(cancelLinkSeconds('2026-11-14', now)).toBe(
      Math.round((Date.parse('2026-11-16T00:00:00Z') - now.getTime()) / 1000),
    )
    expect(cancelLinkSeconds('2020-01-01', now)).toBe(86_400)
  })
})

const fields: FormField[] = [
  { id: 'a', kind: 'text', labelFr: 'Allergies ?', labelEn: '', required: false, options: [] },
  {
    id: 'b',
    kind: 'choice',
    labelFr: 'Repas',
    labelEn: '',
    required: true,
    options: [
      { fr: 'Poulet', en: 'Chicken' },
      { fr: 'Poisson', en: 'Fish' },
    ],
  },
  {
    id: 'c',
    kind: 'multi',
    labelFr: 'Jours',
    labelEn: '',
    required: false,
    options: [
      { fr: 'Sam', en: 'Sat' },
      { fr: 'Dim', en: 'Sun' },
    ],
  },
  { id: 'd', kind: 'yesno', labelFr: 'Transport ?', labelEn: '', required: true, options: [] },
]
describe('answers', () => {
  it('keeps what the form asks for, nothing else', () => {
    const r = checkAnswers(fields, {
      b: 'Poulet',
      d: false,
      c: ['Sam', 'Sam'],
      x: 'ignored',
      a: '  riz ',
    })
    expect(r.problems).toEqual([])
    expect(r.answers).toEqual({ a: 'riz', b: 'Poulet', c: ['Sam'], d: false })
  })
  it('reports what is missing or not a choice', () => {
    const r = checkAnswers(fields, { b: 'Pizza', c: ['Lun'] })
    expect(r.problems).toEqual([
      { field: 'b', code: 'invalid' },
      { field: 'c', code: 'invalid' },
      { field: 'd', code: 'required' },
    ])
    expect(checkAnswers(fields, { d: true }).problems).toEqual([{ field: 'b', code: 'required' }])
  })
})

describe('questions the builder refuses', () => {
  it('refuses health, origin, religion, politics and money', () => {
    for (const q of [
      'Avez-vous des allergies ?',
      'Problème de santé',
      'Votre tribu',
      'Salaire mensuel',
      'Any disability?',
      'Political party',
    ])
      expect(looksSensitive(q), q).toBe(true)
    for (const q of ['Repas souhaité', 'Taille du t-shirt', 'Transport ?', 'Groupe'])
      expect(looksSensitive(q), q).toBe(false)
  })
})

describe('codes and CSV', () => {
  it('makes six characters that cannot be confused', () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
  })
  it('defuses formulas and doubles quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell('+237677123456')).toBe('"\'+237677123456"')
    expect(csvCell('Ada')).toBe('"Ada"')
    expect(csvCell(null)).toBe('""')
  })
})
