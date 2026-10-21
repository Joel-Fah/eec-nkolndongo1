import { describe, expect, it } from 'vitest'
import { type CacheDeps, cachedResponse } from './cache.ts'

const memoryCache = () => {
  const store = new Map<string, Response>()
  return {
    match: async (r: Request) => store.get(r.url)?.clone(),
    put: async (r: Request, res: Response) => void store.set(r.url, res),
  } as unknown as Pick<Cache, 'match' | 'put'>
}

const setup = () => {
  let clock = 1_000_000
  const opened: string[] = []
  const closed: string[] = []
  const pending: Promise<unknown>[] = []
  const deps: CacheDeps = {
    cache: memoryCache(),
    now: () => clock,
    requestDb: async () => ({ id: 'request' }) as never,
    withFreshDb: async (fn) => {
      opened.push('fresh')
      try {
        return await fn({ id: 'fresh' } as never)
      } finally {
        closed.push('fresh')
      }
    },
    background: (p) => void pending.push(p),
  }
  return { deps, advance: (s: number) => (clock += s * 1000), pending, opened, closed }
}

describe('cachedResponse', () => {
  it('miss, then hit, then stale refreshes on its own connection', async () => {
    const t = setup()
    const seen: string[] = []
    const opts = {
      key: 'k',
      ttl: 10,
      keep: 1000,
      load: async (db: { id?: string }) => {
        seen.push(db.id ?? '')
        return { n: seen.length }
      },
    }
    expect((await cachedResponse(t.deps, opts as never)).headers.get('x-eec-cache')).toBe('miss')
    expect((await cachedResponse(t.deps, opts as never)).headers.get('x-eec-cache')).toBe('hit')
    t.advance(11)
    const stale = await cachedResponse(t.deps, opts as never)
    expect(stale.headers.get('x-eec-cache')).toBe('stale')
    await Promise.all(t.pending)
    expect(seen).toEqual(['request', 'fresh'])
    expect(t.closed).toEqual(['fresh'])
    const after = await cachedResponse(t.deps, opts as never)
    expect(after.headers.get('x-eec-cache')).toBe('hit')
    expect(await after.json()).toEqual({ n: 2 })
  })

  it('serves the stale copy when the refresh fails', async () => {
    const t = setup()
    let fail = false
    const opts = {
      key: 'k2',
      ttl: 10,
      keep: 1000,
      load: async () => {
        if (fail) throw new Error('down')
        return { ok: true }
      },
    }
    await cachedResponse(t.deps, opts)
    t.advance(20)
    fail = true
    const res = await cachedResponse(t.deps, opts)
    await Promise.all(t.pending)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-eec-cache')).toBe('stale')
  })

  it('answers 503 (never hangs) when cold and the database is slow', async () => {
    const t = setup()
    const res = await cachedResponse(t.deps, {
      key: 'k3',
      ttl: 10,
      keep: 1000,
      timeoutMs: 20,
      load: () => new Promise(() => {}),
    })
    expect(res.status).toBe(503)
  })
})
