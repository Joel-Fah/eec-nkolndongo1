import { describe, expect, it } from 'vitest'
import { guideBody, stepBody } from './api.ts'

describe('guides input', () => {
  it('accepts a guide with steps and refuses unknown fields and icons', () => {
    expect(
      guideBody.safeParse({ titleFr: 'Baptême', steps: [{ titleFr: 'Écrire au secrétariat' }] })
        .success,
    ).toBe(true)
    expect(guideBody.safeParse({ titleFr: 'x', state: 'published' }).success).toBe(false)
    expect(guideBody.safeParse({ icon: 'skull' }).success).toBe(false)
    expect(guideBody.safeParse({ titleFr: '' }).success).toBe(false)
  })
  it('caps the number and size of steps', () => {
    expect(guideBody.safeParse({ steps: Array.from({ length: 31 }, () => ({})) }).success).toBe(
      false,
    )
    expect(stepBody.safeParse({ documentsFr: 'x'.repeat(801) }).success).toBe(false)
  })
})
