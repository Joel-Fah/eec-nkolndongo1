import { describe, expect, it } from 'vitest'
import { slugify } from './slug.ts'

describe('slugify', () => {
  it('strips accents, apostrophes and punctuation', () => {
    expect(slugify('Ce que nous croyons')).toBe('ce-que-nous-croyons')
    expect(slugify('Fête des Moissons')).toBe('fete-des-moissons')
    expect(slugify('L’Église : « Paix » !')).toBe('l-eglise-paix')
    expect(slugify('  Pasteurs & Conseil  ')).toBe('pasteurs-conseil')
  })
})
