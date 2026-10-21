import { describe, expect, it } from 'vitest'
import { signPreview, verifyPreview } from './preview.ts'

const id = '0b8e1c7e-0000-4000-8000-000000000001'
describe('preview links', () => {
  it('verifies a fresh link and returns the item id', async () => {
    const t = await signPreview('s3cret', 'news', id)
    expect(await verifyPreview('s3cret', t, 'news')).toBe(id)
  })
  it('rejects a wrong secret, a wrong kind, a tampered or expired link', async () => {
    const t = await signPreview('s3cret', 'news', id, 60, 0)
    expect(await verifyPreview('other', t, 'news', 1000)).toBeNull()
    expect(await verifyPreview('s3cret', t, 'events', 1000)).toBeNull()
    expect(await verifyPreview('s3cret', t, 'news', 61_000)).toBeNull()
    expect(await verifyPreview('s3cret', `${t}x`, 'news', 1000)).toBeNull()
    const [body, mac] = t.split('.')
    expect(await verifyPreview('s3cret', `${body?.slice(0, -2)}AA.${mac}`, 'news', 1000)).toBeNull()
    expect(await verifyPreview('s3cret', 'garbage', 'news')).toBeNull()
  })
})
