import { describe, expect, it } from 'vitest'
import { cleanUrl, patchSchema, seriesSchema, youtubeIdOf } from './api.ts'

describe('sermon links', () => {
  it('reads a YouTube video from any common address, or the bare id', () => {
    const id = 'dQw4w9WgXcQ'
    expect(youtubeIdOf(`https://www.youtube.com/watch?v=${id}&t=10s`)).toBe(id)
    expect(youtubeIdOf(`https://youtu.be/${id}?si=abc`)).toBe(id)
    expect(youtubeIdOf(`https://www.youtube.com/embed/${id}`)).toBe(id)
    expect(youtubeIdOf(`https://m.youtube.com/shorts/${id}`)).toBe(id)
    expect(youtubeIdOf(id)).toBe(id)
    expect(youtubeIdOf('')).toBe('')
  })
  it('refuses what is not a YouTube video', () => {
    expect(youtubeIdOf('https://evil.example/watch?v=dQw4w9WgXcQ')).toBe('')
    expect(youtubeIdOf('https://www.youtube.com/watch?v=short')).toBe('')
    expect(youtubeIdOf('javascript:alert(1)')).toBe('')
  })
  it('keeps only plain https addresses, whatever the host', () => {
    expect(cleanUrl('https://drive.google.com/file/d/abc/view?usp=sharing')).toContain(
      'drive.google.com',
    )
    expect(cleanUrl('https://example.org/audio.mp3')).toBe('https://example.org/audio.mp3')
    expect(cleanUrl('http://example.org/a')).toBeNull()
    expect(cleanUrl('javascript:alert(1)')).toBeNull()
    expect(cleanUrl('data:text/html,<b>x</b>')).toBeNull()
    expect(cleanUrl('https://user:pw@example.org/')).toBeNull()
    expect(cleanUrl('https://localhost/')).toBeNull()
    expect(cleanUrl(`https://example.org/${'a'.repeat(500)}`)).toBeNull()
  })
})

describe('sermon input', () => {
  it('accepts a partial update and refuses unknown fields (consent has its own server rule)', () => {
    expect(patchSchema.safeParse({ titleFr: 'Le bon berger' }).success).toBe(true)
    expect(patchSchema.safeParse({ state: 'published' }).success).toBe(false)
    expect(patchSchema.safeParse({ preacherConfirmedBy: 'x' }).success).toBe(false)
  })
  it('links are optional, capped, and must be https', () => {
    expect(patchSchema.safeParse({ links: [] }).success).toBe(true)
    expect(
      patchSchema.safeParse({ links: [{ label: 'Audio', url: 'https://drive.google.com/x' }] })
        .success,
    ).toBe(true)
    expect(
      patchSchema.safeParse({ links: [{ label: 'x', url: 'http://a.example/x' }] }).success,
    ).toBe(false)
    expect(
      patchSchema.safeParse({
        links: Array.from({ length: 5 }, () => ({ label: '', url: 'https://a.example/x' })),
      }).success,
    ).toBe(false)
  })
  it('passages are checked against the books of the Bible', () => {
    expect(
      patchSchema.safeParse({ refs: [{ book: 'mat', chapter: 5, from: 3, to: 12 }] }).success,
    ).toBe(true)
    expect(patchSchema.safeParse({ refs: [{ book: 'nope', chapter: 1 }] }).success).toBe(false)
  })
  it('dates are plain days; series need no field but are bounded', () => {
    expect(patchSchema.safeParse({ preachedOn: '2026-10-25' }).success).toBe(true)
    expect(patchSchema.safeParse({ preachedOn: '25/10/2026' }).success).toBe(false)
    expect(seriesSchema.safeParse({ titleFr: 'x'.repeat(161) }).success).toBe(false)
  })
})
