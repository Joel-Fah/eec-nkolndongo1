import { describe, expect, it } from 'vitest'
import { cleanUrl, createBody, patchBody } from './api.ts'

const block = (over = {}) => ({
  id: 'abcd1234',
  kind: 'announcements',
  titleFr: 'Annonces',
  titleEn: '',
  items: [{ titleFr: 'Réunion', titleEn: '', textFr: 'Samedi', textEn: '' }],
  ...over,
})

describe('bulletin input', () => {
  it('is for a Sunday (a real date that falls on one)', () => {
    expect(createBody.safeParse({ weekOf: '2026-10-25' }).success).toBe(true)
    expect(createBody.safeParse({ weekOf: '2026-10-26' }).success).toBe(false)
    expect(createBody.safeParse({ weekOf: '25/10/2026' }).success).toBe(false)
  })
  it('takes known block kinds only, a bounded number of blocks and lines', () => {
    expect(patchBody.safeParse({ blocks: [block()] }).success).toBe(true)
    expect(patchBody.safeParse({ blocks: [block({ kind: 'script' })] }).success).toBe(false)
    expect(
      patchBody.safeParse({
        blocks: Array.from({ length: 13 }, (_, i) => block({ id: `abcd${i}abc` })),
      }).success,
    ).toBe(false)
    expect(
      patchBody.safeParse({
        blocks: [
          block({
            items: Array.from({ length: 41 }, () => ({
              titleFr: '',
              titleEn: '',
              textFr: 'x',
              textEn: '',
            })),
          }),
        ],
      }).success,
    ).toBe(false)
    expect(patchBody.safeParse({ state: 'published' }).success).toBe(false)
  })
  it('the paper PDF is an https address or nothing', () => {
    expect(cleanUrl('')).toBe('')
    expect(cleanUrl('https://drive.google.com/file/d/x/view')).toContain('drive.google.com')
    expect(cleanUrl('http://example.org/a.pdf')).toBeNull()
    expect(cleanUrl('javascript:alert(1)')).toBeNull()
    expect(patchBody.safeParse({ pdfUrl: 'ftp://x.example/a' }).success).toBe(false)
  })
})
