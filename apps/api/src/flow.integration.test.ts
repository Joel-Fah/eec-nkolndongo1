/**
 * End-to-end through the real API against the Neon `dev` branch. Skipped when no database is configured
 * (CI). Run: `pnpm --filter @eec/api test:integration`.
 */
import { createLink } from '@eec/auth'
import { connect, schema } from '@eec/db'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'

const url = process.env.DATABASE_URL_UNPOOLED
const run = url && process.env.NEON_BRANCH === 'dev'
const ORIGIN = 'http://localhost:8080'
const env = {
  DATABASE_URL_UNPOOLED: url,
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-secret-test-secret-test-secret',
  APP_ORIGIN: ORIGIN,
}
const tag = `it-${Date.now()}`

describe.skipIf(!run)('platform flow (dev database)', () => {
  const app = createApp()
  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(
      `/api${path}`,
      {
        ...init,
        headers: {
          'content-type': 'application/json',
          origin: ORIGIN,
          'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250)}`,
          ...(cookie ? { cookie } : {}),
          ...(init.headers ?? {}),
        },
      },
      env,
    )
  const post = (path: string, body: unknown, cookie?: string) =>
    req(path, { method: 'POST', body: JSON.stringify(body) }, cookie)
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const json = async (res: Response) => (await res.json()) as any
  const cookieOf = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
  const pw = 'une-phrase-solide-2026'
  let adminCookie = ''
  let editorCookie = ''
  let editorId = ''

  beforeAll(async () => {
    const { db, close } = await connect(url as string)
    const { token } = await createLink(db, {
      kind: 'invite',
      email: `${tag}-admin@example.test`,
      roles: [{ roleKey: 'super-admin' }],
      createdBy: null,
    })
    await close()
    const res = await post(`/invitations/${token}/accept`, { name: 'Test Admin', password: pw })
    expect(res.status).toBe(200)
    adminCookie = cookieOf(res)
  })

  afterAll(async () => {
    const { db, close } = await connect(url as string)
    // Test cleanup only: lift the last-super-admin guard to remove our own super admin.
    await db.$client.query(
      'alter table user_roles disable trigger user_roles_guard_last_super_admin',
    )
    await db.delete(schema.user).where(like(schema.user.email, `${tag}%`))
    await db.$client.query(
      'alter table user_roles enable trigger user_roles_guard_last_super_admin',
    )
    await db.delete(schema.accessLinks).where(like(schema.accessLinks.email, `${tag}%`))
    await db.delete(schema.auditLog).where(like(schema.auditLog.summaryFr, `%${tag}%`))
    await close()
  })

  it('the super admin has every right', async () => {
    const me = await json(await req('/me', {}, adminCookie))
    expect(me.isSuperAdmin).toBe(true)
    expect(me.permissions).toEqual(['*'])
  })

  it('anonymous visitors get 401, not data', async () => {
    expect((await req('/me')).status).toBe(401)
    expect((await post('/users/invitations', { email: 'a@example.test' })).status).toBe(401)
  })

  it('invites an editor with a single-use link, who then signs in as staff', async () => {
    const inv = await post(
      '/users/invitations',
      { email: `${tag}-editor@example.test`, roles: [{ roleKey: 'editeur' }] },
      adminCookie,
    )
    expect(inv.status).toBe(201)
    const { url: link } = await json(inv)
    const token = link.split('/').pop()
    expect((await req(`/invitations/${token}`)).status).toBe(200)
    const accept = await post(`/invitations/${token}/accept`, {
      name: 'Test Éditeur',
      password: pw,
    })
    expect(accept.status).toBe(200)
    editorCookie = cookieOf(accept)
    const me = await json(await req('/me', {}, editorCookie))
    editorId = me.user.id
    expect(me.isSuperAdmin).toBe(false)
    expect(me.roles.map((r: { role: string }) => r.role).sort()).toEqual(['editeur', 'membre'])
    // the link is dead after use
    expect((await post(`/invitations/${token}/accept`, { name: 'x', password: pw })).status).toBe(
      404,
    )
    // staff sessions last 12 h, not 30 days
    const { db, close } = await connect(url as string)
    const [s] = await db
      .select({ e: schema.session.expiresAt })
      .from(schema.session)
      .where(eq(schema.session.userId, editorId))
    await close()
    const hours = ((s?.e.getTime() ?? 0) - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(11)
    expect(hours).toBeLessThanOrEqual(12.01)
  })

  it('an editor cannot invite anyone (403)', async () => {
    expect(
      (await post('/users/invitations', { email: `${tag}-x@example.test` }, editorCookie)).status,
    ).toBe(403)
  })

  it('rejects weak passwords and cross-origin posts', async () => {
    const { db, close } = await connect(url as string)
    const { token } = await createLink(db, {
      kind: 'invite',
      email: `${tag}-weak@example.test`,
      createdBy: null,
    })
    await close()
    expect(
      (await post(`/invitations/${token}/accept`, { name: 'W', password: 'password123' })).status,
    ).toBe(400)
    expect(
      (
        await req(
          '/users/invitations',
          { method: 'POST', body: '{}', headers: { origin: 'https://evil.example' } },
          adminCookie,
        )
      ).status,
    ).toBe(403)
  })

  it('an admin can generate a reset link; the new password works and old sessions die', async () => {
    const res = await post(`/users/${editorId}/reset-link`, {}, adminCookie)
    expect(res.status).toBe(201)
    const token = (await json(res)).url.split('/').pop()
    const reset = await post(`/reset/${token}`, { password: 'un-autre-mot-de-passe-2026' })
    expect(reset.status).toBe(200)
    expect((await req('/me', {}, editorCookie)).status).toBe(401)
    const signIn = await post('/auth/sign-in/email', {
      email: `${tag}-editor@example.test`,
      password: 'un-autre-mot-de-passe-2026',
    })
    expect(signIn.status).toBe(200)
  })

  it('refuses to remove the last super admin (database guard)', async () => {
    const { db, close } = await connect(url as string)
    const others = await db.$client.query(
      "select count(distinct ur.user_id)::int n from user_roles ur join roles r on r.id=ur.role_id and r.key='super-admin' join profiles p on p.user_id=ur.user_id and p.status='active'",
    )
    // Only meaningful when our test admin is the only one (true on a fresh dev branch).
    if (others.rows[0].n === 1) {
      await expect(
        db.$client.query(
          "delete from user_roles using roles r where r.id = user_roles.role_id and r.key='super-admin'",
        ),
      ).rejects.toThrow(/last_super_admin/)
      await expect(
        db.$client.query(
          "update profiles set status='deactivated' where user_id in (select ur.user_id from user_roles ur join roles r on r.id=ur.role_id and r.key='super-admin')",
        ),
      ).rejects.toThrow(/last_super_admin/)
    }
    await close()
  })

  it('writes audit entries without secrets', async () => {
    const { db, close } = await connect(url as string)
    const rows = await db
      .select()
      .from(schema.auditLog)
      .where(like(schema.auditLog.summaryFr, `%${tag}%`))
    await close()
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['invite.create']))
    expect(JSON.stringify(rows)).not.toMatch(/password|token_hash|une-phrase/i)
    expect(rows.every((r) => !r.ipHash || r.ipHash.length === 24)).toBe(true)
  })
})
