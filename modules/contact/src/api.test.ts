import { describe, expect, it } from 'vitest'
import { noteBody, patchBody, submitBody } from './api.ts'

const ok = {
  name: 'Marie',
  email: 'marie@example.com',
  category: 'renseignement',
  message: 'Bonjour, une question.',
  consent: true,
  token: 'signed-by-the-server',
  website: '',
}

describe('contact input', () => {
  it('accepts a complete, consented message', () =>
    expect(submitBody.safeParse(ok).success).toBe(true))
  it('needs consent, ticked explicitly (never assumed)', () => {
    expect(submitBody.safeParse({ ...ok, consent: false }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, consent: undefined }).success).toBe(false)
  })
  it('needs an email or a phone', () => {
    expect(submitBody.safeParse({ ...ok, email: '', phone: '' }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, email: '', phone: '+237 6 00 00 00 00' }).success).toBe(
      true,
    )
  })
  it('bounds the lengths and refuses unknown categories and fields', () => {
    expect(submitBody.safeParse({ ...ok, message: 'x'.repeat(2001) }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, message: 'court' }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, category: 'spam' }).success).toBe(false)
    expect(submitBody.safeParse({ ...ok, sensitive: false }).success).toBe(false) // sensitivity is decided by the server
  })
  it('staff changes: only known statuses', () => {
    expect(patchBody.safeParse({ status: 'handled' }).success).toBe(true)
    expect(patchBody.safeParse({ status: 'deleted' }).success).toBe(false)
    expect(noteBody.safeParse({ body: '' }).success).toBe(false)
  })
})

// ——— Prayer requests: only `contact:read-sensitive` sees them (route level, with a recording stub database) ———
import type { AppEnv } from '@eec/api-kit'
import type { Principal } from '@eec/auth'
import { PgDialect } from 'drizzle-orm/pg-core'
import { Hono } from 'hono'
import { contactApi } from './api.ts'

const principal = (permissions: string[]): Principal =>
  ({
    userId: 'u1',
    status: 'active',
    isSuperAdmin: false,
    grants: [{ groupId: null, permissions: new Set(permissions) }],
  }) as unknown as Principal

const prayer = {
  id: '11111111-1111-1111-1111-111111111111',
  sensitive: true,
  status: 'new',
  // the notes query reads the same stub rows
  n: { id: 'n1', body: '', createdAt: new Date() },
  author: null,
  assignedTo: null,
}

/** A database that returns `rows` for every query and remembers the `where` clauses it was given. */
function stubDb(rows: unknown[]) {
  const wheres: unknown[] = []
  const chain: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => void) => res(rows)
      if (prop === 'where') return (w: unknown) => (wheres.push(w), chain)
      return () => chain
    },
    apply: () => chain,
  })
  const call = () => chain
  return { db: { select: call, update: call, delete: call, insert: call }, wheres }
}

function appFor(permissions: string[], rows: unknown[]) {
  const stub = stubDb(rows)
  const app = new Hono<AppEnv>()
  app.use(async (c, next) => {
    const p = principal(permissions)
    c.set('deps', {
      db: async () => stub.db,
      actor: async () => ({ userId: 'u1', principal: p }),
    } as never)
    await next()
  })
  app.route('/', contactApi)
  const request = (path: string, init?: RequestInit) =>
    app.request(path, init, { AUTH_SECRET: 'test-secret' })
  return { app: { request }, stub }
}
const sqlOf = (w: unknown) => (w ? new PgDialect().sqlToQuery(w as never) : { sql: '' })

describe('prayer requests are sensitive', () => {
  it('a reader without contact:read-sensitive gets a 404 on one, and cannot touch it', async () => {
    const { app } = appFor(['contact:read', 'contact:handle', 'contact:delete'], [prayer])
    expect((await app.request(`/${prayer.id}`)).status).toBe(404)
    const patch = await app.request(`/${prayer.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'handled' }),
    })
    expect(patch.status).toBe(404)
    const note = await app.request(`/${prayer.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: 'note' }),
    })
    expect(note.status).toBe(404)
    expect((await app.request(`/${prayer.id}`, { method: 'DELETE' })).status).toBe(404)
  })
  it('with contact:read-sensitive the same message opens', async () => {
    const { app } = appFor(['contact:read', 'contact:read-sensitive'], [prayer])
    expect((await app.request(`/${prayer.id}`)).status).toBe(200)
  })
  it('the list and the counter exclude sensitive rows unless allowed', async () => {
    for (const path of ['/', '/counts']) {
      const without = appFor(['contact:read'], [])
      await without.app.request(path)
      expect(without.stub.wheres.map((w) => sqlOf(w).sql).join(' ')).toContain('"sensitive"')
      const withPerm = appFor(['contact:read', 'contact:read-sensitive'], [])
      await withPerm.app.request(path)
      expect(withPerm.stub.wheres.map((w) => sqlOf(w).sql).join(' ')).not.toContain('"sensitive"')
    }
  })
  it('the form token cannot be forged: a bad token is refused before anything is stored', async () => {
    const { app } = appFor([], [])
    const res = await app.request('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...ok, token: 'forged.token-value' }),
    })
    expect(res.status).toBe(400)
  })
})
