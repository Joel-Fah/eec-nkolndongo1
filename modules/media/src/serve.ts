/**
 * Public files: GET /media/<kind>/<yyyy>/<mm>/<id>/<variant>.<ext>, streamed from the object store.
 * Immutable (a file is never replaced), Range for audio, ETag, nosniff; no listing; images and PDFs
 * also sit in the edge cache so the store's monthly egress is spared (decision 0020).
 */
import type { Env } from '@eec/api-kit'
import { MIME_BY_EXT, PUBLIC_KEY } from './rules.ts'
import { createStore } from './store.ts'

const EDGE_MAX = 5 * 1024 * 1024
const notFound = () =>
  new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })

export async function serveMedia(
  request: Request,
  env: Env,
  ctx?: { waitUntil(p: Promise<unknown>): void },
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
  const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/media\//, ''))
  if (!PUBLIC_KEY.test(key)) return notFound()

  const range = request.headers.get('range')
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
  const cacheable = !range && !key.startsWith('audio/') && request.method === 'GET'
  if (cacheable && cache) {
    const hit = await cache.match(request)
    if (hit) return hit
  }

  const upstream = await createStore(env).get(key, {
    ...(range ? { range } : {}),
    ...(request.headers.get('if-none-match')
      ? { 'if-none-match': request.headers.get('if-none-match') as string }
      : {}),
  })
  if (upstream.status === 404 || upstream.status === 403) return notFound()
  if (!upstream.ok && upstream.status !== 304 && upstream.status !== 206) return notFound()

  const ext = key.split('.').pop() ?? ''
  const headers = new Headers({
    'content-type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline',
  })
  for (const h of ['content-length', 'content-range', 'etag', 'last-modified'] as const) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  const res = new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers,
  })
  if (
    cacheable &&
    cache &&
    upstream.status === 200 &&
    Number(headers.get('content-length') ?? EDGE_MAX + 1) <= EDGE_MAX
  )
    ctx?.waitUntil(cache.put(request, res.clone()))
  return res
}
