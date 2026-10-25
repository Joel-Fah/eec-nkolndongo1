import type { AppEnv } from '@eec/api-kit'
import type { Principal } from '@eec/auth'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { validationRoutes } from './validation.ts'

const principal = (permissions: string[]) =>
  ({
    userId: 'u1',
    status: 'active',
    isSuperAdmin: false,
    grants: [{ groupId: null, permissions: new Set(permissions) }],
  }) as unknown as Principal

function app(permissions: string[]) {
  const a = new Hono<AppEnv>()
  a.use(async (c, next) => {
    c.set('deps', {
      db: async () => {
        throw new Error('the database must not be reached before the permission check')
      },
      actor: async () => ({ userId: 'u1', principal: principal(permissions) }),
    } as never)
    await next()
  })
  a.route('/', validationRoutes)
  return a
}
const post = (a: ReturnType<typeof app>, path: string, body: unknown) =>
  a.request(path, { method: 'POST', body: JSON.stringify(body) })

describe('« À valider » permissions', () => {
  it('needs core:validation-read to list, approve or comment', async () => {
    const a = app(['news:read'])
    expect((await a.request('/')).status).toBe(403)
    expect((await post(a, '/approve', { id: 'settings:parish.phones' })).status).toBe(403)
    expect(
      (await post(a, '/comment', { id: 'settings:parish.phones', kind: 'note', body: 'ok?' }))
        .status,
    ).toBe(403)
  })
  it('refuses a malformed item id', async () => {
    const a = app(['core:validation-read'])
    expect((await post(a, '/approve', { id: 'drop table' })).status).toBe(400)
  })
})
