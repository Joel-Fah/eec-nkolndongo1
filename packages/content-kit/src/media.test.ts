import { describe, expect, it } from 'vitest'
import { mediaSrc } from './MediaPicker.tsx'

const variants = [
  { key: 'a/w1600.webp', width: 1600, mime: 'image/webp' },
  { key: 'a/w480.webp', width: 480, mime: 'image/webp' },
  { key: 'a/w960.webp', width: 960, mime: 'image/webp' },
]
describe('mediaSrc', () => {
  it('picks the smallest variant at least as wide as asked, else the largest', () => {
    expect(mediaSrc({ variants }, 480)).toBe('/media/a/w480.webp')
    expect(mediaSrc({ variants }, 700)).toBe('/media/a/w960.webp')
    expect(mediaSrc({ variants }, 5000)).toBe('/media/a/w1600.webp')
    expect(mediaSrc({ variants: [] })).toBe('')
  })
})
