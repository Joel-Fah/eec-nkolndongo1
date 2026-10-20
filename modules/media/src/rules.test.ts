import { describe, expect, it } from 'vitest'
import { mediaKey, PUBLIC_KEY, parseRange, sniff } from './rules.ts'

const bytes = (...v: (number | string)[]) =>
  Uint8Array.from(
    v.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])),
  )

describe('sniff', () => {
  it('recognises what we accept, by the first bytes', () => {
    expect(sniff(bytes('RIFF', 0, 0, 0, 0, 'WEBP', 'VP8 '))?.mime).toBe('image/webp')
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))?.mime).toBe('image/jpeg')
    expect(sniff(bytes('%PDF-1.7', 0, 0, 0, 0))?.kind).toBe('document')
    expect(sniff(bytes('ID3', 4, 0, 0, 0, 0, 0, 0, 0, 0))?.mime).toBe('audio/mpeg')
    expect(sniff(bytes(0, 0, 0, 0x20, 'ftypM4A ', 0))?.mime).toBe('audio/mp4')
  })
  it('refuses scripts, html and anything unknown whatever the name', () => {
    expect(sniff(bytes('<script>alert(1)</script>'))).toBeNull()
    expect(sniff(bytes('<!doctype html><html>'))).toBeNull()
    expect(sniff(bytes('MZ', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull()
    expect(sniff(bytes(1, 2, 3))).toBeNull()
  })
})

describe('keys', () => {
  it('builds kind/yyyy/mm/id/variant.ext', () => {
    const id = '0b7f3c52-6a4e-4a3a-9d84-2f6c1e0a9b11'
    const key = mediaKey('image', id, 'w480', 'webp', new Date('2026-10-20T10:00:00Z'))
    expect(key).toBe(`image/2026/10/${id}/w480.webp`)
    expect(PUBLIC_KEY.test(key)).toBe(true)
  })
  it('only serves well-formed keys', () => {
    for (const bad of [
      '../etc/passwd',
      'image/',
      'image/2026/10/x/../../a.webp',
      'other/2026/10/0b7f3c52-6a4e-4a3a-9d84-2f6c1e0a9b11/a.webp',
      'image/2026/10/0b7f3c52-6a4e-4a3a-9d84-2f6c1e0a9b11/A.webp',
    ])
      expect(PUBLIC_KEY.test(bad)).toBe(false)
  })
})

describe('parseRange', () => {
  it('handles start-end, open-ended and suffix ranges', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 })
  })
  it('rejects nonsense', () => {
    expect(parseRange('bytes=2000-', 1000)).toBeNull()
    expect(parseRange('items=1-2', 1000)).toBeNull()
    expect(parseRange(null, 1000)).toBeNull()
    expect(parseRange('bytes=-', 1000)).toBeNull()
  })
})
