/**
 * Edge cache for public JSON (decision 0021), on the Workers Cache API (one data centre at a time):
 * - fresh for `ttl` seconds, then served stale while a background refresh runs (stale-while-revalidate);
 * - if the database is cold or down, the last good value is served for up to `keep` seconds;
 * - the key includes the content version, so a save is picked up without a purge.
 * Where there is no Cache API (tests, some dev paths) it simply calls `load`.
 */
import type { Context } from 'hono'
import type { AppEnv } from './context.ts'

const STORED_AT = 'x-eec-stored-at'

export async function cachedJson<T>(
  c: Context<AppEnv>,
  opts: { key: string; ttl: number; keep: number; load: () => Promise<T> },
): Promise<Response> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
  const request = new Request(`https://cache.eec.internal/${opts.key}`)
  const respond = (body: string, state: 'hit' | 'stale' | 'miss') =>
    new Response(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Browsers keep it briefly; the edge copy is managed here.
        'cache-control': `public, max-age=${Math.min(opts.ttl, 60)}, stale-while-revalidate=${opts.ttl}`,
        'x-eec-cache': state,
      },
    })
  const store = async (body: string) => {
    if (!cache) return
    await cache.put(
      request,
      new Response(body, {
        headers: {
          'cache-control': `public, max-age=${opts.keep}`,
          [STORED_AT]: String(Date.now()),
        },
      }),
    )
  }
  const fresh = async () => {
    const body = JSON.stringify(await opts.load())
    await store(body)
    return body
  }

  const hit = cache ? await cache.match(request) : undefined
  if (hit) {
    const body = await hit.text()
    const age = (Date.now() - Number(hit.headers.get(STORED_AT) ?? 0)) / 1000
    if (age < opts.ttl) return respond(body, 'hit')
    const refresh = fresh().catch(() => {})
    try {
      c.executionCtx.waitUntil(refresh)
    } catch {
      await refresh
    }
    return respond(body, 'stale')
  }
  return respond(await fresh(), 'miss')
}
