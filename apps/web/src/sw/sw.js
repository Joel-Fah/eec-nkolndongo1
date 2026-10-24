/*
 * The service worker (decision 0037): hand-written, no library. It makes the PUBLIC pages readable again when the network fails
 * and nothing else. Rules, in order of importance:
 *   - only GET navigations to /fr/… and /en/… are ever kept; everything else (admin, /api, auth, Mon espace, previews,
 *     registration and cancel pages, search, anything with ?t= or ?simule=) goes straight to the network, untouched;
 *   - a response is kept only if it is a 200 HTML page whose cache-control allows it (never `private` or `no-store`);
 *   - network first (4 s), then the copy, then the offline page; at most 40 pages, the oldest dropped.
 * `decide` is pure and tested (sw-rules.test.ts); the rest is the thin shell around it.
 */
const BUILD = '__BUILD__'
const PAGES = `pages-${BUILD}`
const SHELL = `shell-${BUILD}`
const MAX_PAGES = 40
const MAX_IMAGES = 30
const TIMEOUT = 4000
const OFFLINE = { fr: '/fr/hors-ligne/', en: '/en/offline/' }
const PRIVATE =
  /\/(mon-espace|my-space|apercu|preview|inscription|register|recherche|search|_brand|fete-des-moissons|harvest-festival)(\/|$)/
const PRIVATE_QUERY = /[?&](t|simule|token|q)=/

/** What to do with a request: 'page' (navigation to keep), 'asset' (hashed build file, cache first), 'image', or 'skip'. */
function decide(req) {
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== req.origin) return 'skip'
  if (req.headers && req.headers.get('range')) return 'skip'
  const path = url.pathname
  if (req.mode === 'navigate' || req.destination === 'document') {
    if (!/^\/(fr|en)\//.test(path)) return 'skip'
    if (PRIVATE.test(path) || PRIVATE_QUERY.test(url.search)) return 'skip'
    return 'page'
  }
  if (
    path.startsWith('/_astro/') ||
    path.startsWith('/fonts/') ||
    path.startsWith('/illustrations/')
  )
    return 'asset'
  if (path.startsWith('/media/') && req.destination === 'image') return 'image'
  return 'skip'
}

/** May this response be kept? A 200 HTML page, and nothing marked private or no-store. */
function keepable(res) {
  if (!res || res.status !== 200) return false
  const type = res.headers.get('content-type') || ''
  if (!/text\/html/.test(type)) return false
  const cc = (res.headers.get('cache-control') || '').toLowerCase()
  if (/\b(private|no-store)\b/.test(cc)) return false
  if (res.headers.get('set-cookie')) return false
  return true
}
const keepableImage = (res) =>
  !!res &&
  res.status === 200 &&
  /^image\//.test(res.headers.get('content-type') || '') &&
  !/\b(private|no-store)\b/i.test(res.headers.get('cache-control') || '')

if (typeof globalThis !== 'undefined')
  globalThis.__swRules = { decide, keepable, keepableImage, MAX_PAGES }

if (
  typeof self !== 'undefined' &&
  typeof self.addEventListener === 'function' &&
  typeof caches !== 'undefined'
) {
  const saveData = () =>
    !!(self.navigator && self.navigator.connection && self.navigator.connection.saveData)

  async function trim(cache, max) {
    const keys = await cache.keys()
    for (const k of keys.slice(0, Math.max(keys.length - max, 0))) await cache.delete(k)
  }
  const withTimeout = (p, ms) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
  /** A copy of a kept page with a marker the page script turns into the « saved copy » badge. */
  async function marked(res) {
    const html = (await res.text()).replace(
      '</head>',
      '<meta name="eec-from-cache" content="1"></head>',
    )
    const headers = new Headers(res.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    return new Response(html, { status: 200, headers })
  }

  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        const shell = await caches.open(SHELL)
        // The offline pages, the stylesheet they use and the fonts that stylesheet names, so the fallback looks like the site.
        for (const path of Object.values(OFFLINE)) {
          const res = await fetch(path, { credentials: 'omit' }).catch(() => null)
          if (!res || res.status !== 200) continue
          await shell.put(path, res.clone())
          const html = await res.text()
          for (const m of html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)) {
            const css = await fetch(m[1]).catch(() => null)
            if (!css || !css.ok) continue
            await shell.put(m[1], css.clone())
            for (const f of (await css.text()).matchAll(/url\((\/_astro\/[^)]+\.woff2)\)/g)) {
              const font = await fetch(f[1]).catch(() => null)
              if (font && font.ok) await shell.put(f[1], font)
            }
          }
        }
        await shell
          .addAll([
            '/mark.svg',
            '/icon-192.png',
            '/favicon.svg',
            '/illustrations/news-light.svg',
            '/illustrations/news-dark.svg',
          ])
          .catch(() => {})
        await self.skipWaiting()
      })(),
    )
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        for (const name of await caches.keys())
          if (name !== PAGES && name !== SHELL) await caches.delete(name)
        await self.clients.claim()
      })(),
    )
  })

  self.addEventListener('fetch', (event) => {
    const req = event.request
    const kind = decide({
      url: req.url,
      method: req.method,
      mode: req.mode,
      destination: req.destination,
      headers: req.headers,
      origin: self.location.origin,
    })
    if (kind === 'skip') return
    if (kind === 'asset') {
      event.respondWith(
        caches.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()))
              return res
            }),
        ),
      )
      return
    }
    if (kind === 'image') {
      event.respondWith(
        caches.match(req).then(async (hit) => {
          if (hit) return hit
          const res = await fetch(req)
          if (!saveData() && keepableImage(res)) {
            const c = await caches.open(`img-${BUILD}`)
            await c.put(req, res.clone())
            await trim(c, MAX_IMAGES)
          }
          return res
        }),
      )
      return
    }
    // A page: the network first; the saved copy only when the network fails or is too slow.
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES)
        try {
          const res = await withTimeout(fetch(req), TIMEOUT)
          if (keepable(res)) {
            await cache.put(req.url, res.clone())
            await trim(cache, MAX_PAGES)
          } else await cache.delete(req.url)
          return res
        } catch {
          const hit = await cache.match(req.url)
          if (hit) return marked(hit)
          const lang = new URL(req.url).pathname.startsWith('/en/') ? 'en' : 'fr'
          const shell = await caches.open(SHELL)
          return (await shell.match(OFFLINE[lang])) || new Response('Offline', { status: 503 })
        }
      })(),
    )
  })
}
