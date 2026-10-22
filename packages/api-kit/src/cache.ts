/**
 * Edge cache for public JSON and HTML (decisions 0021 and 0027), on the Workers Cache API (one data centre at a time):
 * - fresh for `ttl` seconds, then served stale while a background refresh runs (stale-while-revalidate);
 * - if the database is cold or down, the last good value is served for up to `keep` seconds;
 * - the key includes the content version, so a save is picked up without a purge;
 * - nothing waits on a cold database for more than `timeoutMs`: with a stale copy it is served, without one the
 *   caller gets a 503 « unavailable » (public pages then render <UnavailableState>), never a hang or a 500.
 * Where there is no Cache API (tests, some dev paths) it simply calls `load`.
 *
 * The background refresh runs AFTER the response: the request's own database connection is closed by then, so
 * `load` receives a connection to use (the request's one on a miss, a fresh short-lived one on a refresh).
 */
import type { Db } from '@eec/db'
import type { Context } from 'hono'
import type { AppEnv } from './context.ts'

const STORED_AT = 'x-eec-stored-at'
export const DEFAULT_TIMEOUT_MS = 1500

/** Pure core of the cache, with its collaborators passed in, so it can be tested without Workers. */
export type CacheDeps = {
  cache?: Pick<Cache, 'match' | 'put'>
  now?: () => number
  /** Runs `fn` with a database connection that outlives the request (opened and closed around the call). */
  withFreshDb: <R>(fn: (db: Db) => Promise<R>) => Promise<R>
  /** The request's own connection. */
  requestDb: () => Promise<Db>
  /** Keeps a promise alive after the response (ctx.waitUntil); awaited inline where there is none. */
  background: (p: Promise<unknown>) => Promise<unknown> | undefined
  /** The database time-box (default 1.5 s). */
  timeoutMs?: number
}

export type CachedOptions<T> = {
  key: string
  ttl: number
  keep: number
  load: (db: Db) => Promise<T>
  timeoutMs?: number
  contentType?: string
  /** Turns the loaded value into the response body (JSON by default). */
  serialize?: (value: T) => string
}

const timeout = <R>(p: Promise<R>, ms: number) =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])

export async function cachedResponse<T>(
  deps: CacheDeps,
  opts: CachedOptions<T>,
): Promise<Response> {
  const now = deps.now ?? Date.now
  const contentType = opts.contentType ?? 'application/json; charset=utf-8'
  const serialize = opts.serialize ?? ((v: T) => JSON.stringify(v))
  const request = new Request(`https://cache.eec.internal/${opts.key}`)
  const respond = (body: string, state: 'hit' | 'stale' | 'miss', status = 200) =>
    new Response(body, {
      status,
      headers: {
        'content-type': contentType,
        // Browsers keep it briefly; the edge copy is managed here.
        'cache-control': `public, max-age=${Math.min(opts.ttl, 60)}, stale-while-revalidate=${opts.ttl}`,
        'x-eec-cache': state,
      },
    })
  const store = async (body: string) => {
    if (!deps.cache) return
    await deps.cache.put(
      request,
      new Response(body, {
        headers: { 'cache-control': `public, max-age=${opts.keep}`, [STORED_AT]: String(now()) },
      }),
    )
  }
  const refresh = async (db: Db) => {
    const body = serialize(await opts.load(db))
    await store(body)
    return body
  }

  const hit = deps.cache ? await deps.cache.match(request) : undefined
  if (hit) {
    const body = await hit.text()
    const age = (now() - Number(hit.headers.get(STORED_AT) ?? 0)) / 1000
    if (age < opts.ttl) return respond(body, 'hit')
    // Stale: answer now, refresh behind the response on a connection of its own.
    const task = deps.withFreshDb(refresh).catch(() => {})
    const pending = deps.background(task)
    if (pending) await pending
    return respond(body, 'stale')
  }
  try {
    const db = await timeout(
      deps.requestDb(),
      opts.timeoutMs ?? deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )
    return respond(
      await timeout(refresh(db), opts.timeoutMs ?? deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      'miss',
    )
  } catch {
    // Cold or down and nothing stale to serve: say so plainly (callers show a friendly state).
    return new Response(JSON.stringify({ error: { code: 'unavailable' } }), {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '5',
      },
    })
  }
}

/** The route-facing wrapper: wires the Hono context (Workers Cache API, waitUntil, the request's database). */
export function cachedJson<T>(c: Context<AppEnv>, opts: CachedOptions<T>) {
  return cachedResponse(
    {
      cache: (globalThis as { caches?: { default?: Cache } }).caches?.default,
      withFreshDb: (fn) => c.var.deps.withDb(fn),
      requestDb: () => c.var.deps.db(),
      timeoutMs: c.var.deps.timeoutMs,
      background: (p) => {
        try {
          c.executionCtx.waitUntil(p)
          return undefined
        } catch {
          return p
        }
      },
    },
    opts,
  )
}
