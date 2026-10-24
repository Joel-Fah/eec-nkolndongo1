import { describe, expect, it } from 'vitest'
import { recordVisit, visitOf } from './visits.ts'

const env = { ADMIN_PATH: 'admin' }
const PHONE =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const req = (
  path: string,
  headers: Record<string, string> = { 'user-agent': PHONE },
  method = 'GET',
) => new Request(`https://eec.example${path}`, { method, headers })
const html = 'text/html; charset=utf-8'
const at = new Date('2026-10-22T10:00:00Z')

describe('visit counts', () => {
  it('counts a page view with only day, path, language and device class', () => {
    expect(visitOf(req('/fr/actualites/'), 200, html, env, at)).toEqual({
      day: '2026-10-22',
      path: '/fr/actualites',
      locale: 'fr',
      device: 'mobile',
    })
    expect(
      visitOf(
        req('/en/give/', { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120' }),
        200,
        html,
        env,
        at,
      )?.device,
    ).toBe('desktop')
  })
  it('skips what is not a plain page view', () => {
    expect(visitOf(req('/fr/', undefined, 'POST'), 200, html, env, at)).toBeNull()
    expect(visitOf(req('/fr/'), 404, html, env, at)).toBeNull()
    expect(visitOf(req('/fr/'), 200, 'application/json', env, at)).toBeNull()
    expect(visitOf(req('/admin/users'), 200, html, env, at)).toBeNull()
    expect(visitOf(req('/api/news/public'), 200, html, env, at)).toBeNull()
    expect(visitOf(req('/fr/_brand/'), 200, html, env, at)).toBeNull()
    expect(visitOf(req('/fr/actualites/x?preview=abc'), 200, html, env, at)).toBeNull()
  })
  it('respects « do not track » and skips robots and prefetches', () => {
    expect(visitOf(req('/fr/', { 'user-agent': PHONE, dnt: '1' }), 200, html, env, at)).toBeNull()
    expect(
      visitOf(req('/fr/', { 'user-agent': PHONE, 'sec-gpc': '1' }), 200, html, env, at),
    ).toBeNull()
    expect(visitOf(req('/fr/', { 'user-agent': 'Googlebot/2.1' }), 200, html, env, at)).toBeNull()
    expect(
      visitOf(req('/fr/', { 'user-agent': PHONE, 'sec-purpose': 'prefetch' }), 200, html, env, at),
    ).toBeNull()
  })
  it('refuses odd paths (nothing user-supplied is stored)', () => {
    expect(visitOf(req('/fr/a%20b'), 200, html, env, at)).toBeNull()
    expect(visitOf(req(`/fr/${'a'.repeat(130)}`), 200, html, env, at)).toBeNull()
  })
  it('writes no identifier: no ip, no user agent, no cookie in the data point', () => {
    const points: { indexes?: string[]; blobs?: string[]; doubles?: number[] }[] = []
    const e = {
      ADMIN_PATH: 'admin',
      VISITS: { writeDataPoint: (p: (typeof points)[number]) => void points.push(p) },
    }
    recordVisit(
      e as never,
      req('/fr/', { 'user-agent': PHONE, cookie: 'a=b', 'cf-connecting-ip': '1.2.3.4' }),
      new Response('', { headers: { 'content-type': html } }),
      at,
    )
    expect(points).toHaveLength(1)
    expect(JSON.stringify(points[0])).not.toMatch(/Mozilla|Android|1\.2\.3\.4|a=b/)
    expect(points[0]?.blobs).toEqual(['/fr', 'fr', 'mobile'])
  })
  it('is a no-op without the binding', () => {
    expect(() =>
      recordVisit(
        { ADMIN_PATH: 'admin' } as never,
        req('/fr/'),
        new Response('', { headers: { 'content-type': html } }),
      ),
    ).not.toThrow()
  })
})
