/** The service worker must never keep anything private (decision 0037). It is a plain script, so it is run in an empty context. */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const ctx: { __swRules?: any } = {}
runInNewContext(
  readFileSync(new URL('./sw.js', import.meta.url), 'utf8'),
  { URL, globalThis: ctx, Headers },
  {},
)
const rules = ctx.__swRules as {
  decide: (r: Record<string, unknown>) => string
  keepable: (r: Response) => boolean
  keepableImage: (r: Response) => boolean
  MAX_PAGES: number
}
const origin = 'https://site.test'
const nav = (path: string, extra: Record<string, unknown> = {}) =>
  rules.decide({
    url: origin + path,
    method: 'GET',
    mode: 'navigate',
    destination: 'document',
    origin,
    headers: new Headers(),
    ...extra,
  })
const res = (init: { status?: number; type?: string; cc?: string; cookie?: string } = {}) => {
  const h = new Headers({ 'content-type': init.type ?? 'text/html; charset=utf-8' })
  if (init.cc) h.set('cache-control', init.cc)
  return { status: init.status ?? 200, headers: h } as unknown as Response
}

describe('what the service worker may touch', () => {
  it('keeps public pages in both languages', () => {
    for (const p of [
      '/fr/',
      '/en/',
      '/fr/agenda/ce-dimanche/',
      '/en/news/sermons/some-sermon/',
      '/fr/actualites/meditations-et-bulletin/?jour=2026-11-01',
    ])
      expect(nav(p), p).toBe('page')
  })
  it('never touches the admin, the API, auth, Mon espace, previews, registrations, search, tokens', () => {
    for (const p of [
      '/admin/',
      '/gestion/m/news',
      '/api/members/me',
      '/api/auth/get-session',
      '/fr/mon-espace/',
      '/en/my-space/',
      '/fr/actualites/nouvelles/apercu/?t=abc',
      '/en/news/latest/preview/',
      '/fr/agenda/evenements/inscription/camp/',
      '/en/calendar/events/register/cancel/?t=zzz',
      '/fr/recherche/?q=amour',
      '/fr/agenda/fete-des-moissons/?simule=2026-11-02',
      '/fr/_brand/',
      '/sw.js',
      '/media/x.mp3',
    ])
      expect(
        nav(p, {
          destination: p.startsWith('/media') ? 'audio' : 'document',
          mode: p.startsWith('/media') ? 'no-cors' : 'navigate',
        }),
        p,
      ).toBe('skip')
  })
  it('ignores anything that is not a plain GET from our own origin, and ranges', () => {
    expect(nav('/fr/', { method: 'POST' })).toBe('skip')
    expect(nav('/fr/', { url: 'https://other.test/fr/' })).toBe('skip')
    expect(nav('/fr/', { headers: new Headers({ range: 'bytes=0-1' }) })).toBe('skip')
  })
  it('caches build files and images from /media only', () => {
    expect(
      rules.decide({
        url: `${origin}/_astro/app.abc.css`,
        method: 'GET',
        mode: 'no-cors',
        destination: 'style',
        origin,
        headers: new Headers(),
      }),
    ).toBe('asset')
    expect(
      rules.decide({
        url: `${origin}/media/a/b.webp`,
        method: 'GET',
        mode: 'no-cors',
        destination: 'image',
        origin,
        headers: new Headers(),
      }),
    ).toBe('image')
    expect(
      rules.decide({
        url: `${origin}/media/a/b.mp3`,
        method: 'GET',
        mode: 'no-cors',
        destination: 'audio',
        origin,
        headers: new Headers(),
      }),
    ).toBe('skip')
    expect(
      rules.decide({
        url: `${origin}/api/news/public`,
        method: 'GET',
        mode: 'cors',
        destination: '',
        origin,
        headers: new Headers(),
      }),
    ).toBe('skip')
  })
})
describe('what may be kept', () => {
  it('only a 200 HTML page that is not private or no-store', () => {
    expect(rules.keepable(res({ cc: 'public, max-age=30, stale-while-revalidate=120' }))).toBe(true)
    expect(rules.keepable(res())).toBe(true)
    expect(rules.keepable(res({ cc: 'private' }))).toBe(false)
    expect(rules.keepable(res({ cc: 'no-store' }))).toBe(false)
    expect(rules.keepable(res({ status: 404 }))).toBe(false)
    expect(rules.keepable(res({ status: 503 }))).toBe(false)
    expect(rules.keepable(res({ type: 'application/json' }))).toBe(false)
    expect(rules.keepable(res({ type: 'audio/mpeg' }))).toBe(false)
  })
  it('keeps images only when public', () => {
    expect(rules.keepableImage(res({ type: 'image/webp' }))).toBe(true)
    expect(rules.keepableImage(res({ type: 'image/webp', cc: 'private' }))).toBe(false)
    expect(rules.keepableImage(res({ type: 'text/html' }))).toBe(false)
  })
  it('caps the pages kept', () => expect(rules.MAX_PAGES).toBe(40))
})
