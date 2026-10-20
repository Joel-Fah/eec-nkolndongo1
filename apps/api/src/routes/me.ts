/**
 * The signed-in person: who they are, what they may do, which modules are on (the admin builds its menu
 * from this), and Mon compte — profile, language and theme, password, sessions ("sign out everywhere").
 */
import { type AppEnv, audit, fail, requireSelf } from '@eec/api-kit'
import { checkPassword } from '@eec/auth'
import { schema } from '@eec/db'
import { modules } from '@eec/modules'
import { isModuleEnabled } from '@eec/modules-kit'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { z } from 'zod'
import { readFlags } from './flags.ts'

const { user, profiles, session, account } = schema

const patch = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  locale: z.enum(['fr', 'en']).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
})
const password = z.object({ current: z.string().max(200), next: z.string().max(200) })

/** The current session row, from the session cookie (Better Auth). */
async function currentSessionId(c: Context<AppEnv>) {
  const auth = await c.var.deps.auth()
  const s = await auth.api.getSession({ headers: c.req.raw.headers })
  return s?.session.id ?? null
}

export const meRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const [row] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        phone: profiles.phone,
        locale: profiles.locale,
        theme: profiles.theme,
        status: profiles.status,
      })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, actor.userId))
    const p = actor.principal
    const flags = await readFlags(db)
    return c.json({
      user: row,
      isSuperAdmin: p.isSuperAdmin,
      roles: p.grants.map((g) => ({ role: g.roleKey, groupId: g.groupId })),
      // The UI hides what you can't do; the API remains the authority.
      permissions: p.isSuperAdmin
        ? ['*']
        : [...new Set(p.grants.flatMap((g) => [...g.permissions]))],
      modules: Object.fromEntries(modules.map((m) => [m.id, isModuleEnabled(m, flags)])),
    })
  })

  .patch('/', requireSelf(), zValidator('json', patch), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const { name, ...profile } = c.req.valid('json')
    const db = await c.var.deps.db()
    if (name) await db.update(user).set({ name }).where(eq(user.id, actor.userId))
    if (Object.keys(profile).length)
      await db.update(profiles).set(profile).where(eq(profiles.userId, actor.userId))
    await audit(c, {
      action: 'update',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Profil mis à jour par la personne elle-même',
      summaryEn: 'Profile updated by its owner',
      diff: c.req.valid('json'),
    })
    return c.json({ ok: true })
  })

  // Change password: the current one is checked in the database (bcrypt via pgcrypto, decision 0018);
  // every other session is closed.
  .post('/password', requireSelf(), zValidator('json', password), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const { current, next } = c.req.valid('json')
    const problem = checkPassword(next)
    if (problem) return fail(c, 400, `password_${problem}` as 'password_too_short')
    const db = await c.var.deps.db()
    const [ok] = await db
      .select({ ok: sql<boolean>`eec_verify_password(${current}, ${account.password})` })
      .from(account)
      .where(and(eq(account.userId, actor.userId), eq(account.providerId, 'credential')))
    if (!ok?.ok) return fail(c, 400, 'invalid_credentials')
    await db
      .update(account)
      .set({ password: sql`eec_hash_password(${next})`, updatedAt: new Date() })
      .where(and(eq(account.userId, actor.userId), eq(account.providerId, 'credential')))
    const keep = await currentSessionId(c)
    await db
      .delete(session)
      .where(and(eq(session.userId, actor.userId), keep ? ne(session.id, keep) : undefined))
    await audit(c, {
      action: 'password.change',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Mot de passe changé (autres sessions fermées)',
      summaryEn: 'Password changed (other sessions closed)',
    })
    return c.json({ ok: true })
  })

  .get('/sessions', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const current = await currentSessionId(c)
    const rows = await db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(and(eq(session.userId, actor.userId), sql`${session.expiresAt} > now()`))
      .orderBy(desc(session.createdAt))
    return c.json({ sessions: rows.map((s) => ({ ...s, current: s.id === current })) })
  })

  // Sign out everywhere else.
  .delete('/sessions', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const keep = await currentSessionId(c)
    const closed = await db
      .delete(session)
      .where(and(eq(session.userId, actor.userId), keep ? ne(session.id, keep) : undefined))
      .returning({ id: session.id })
    await audit(c, {
      action: 'session.revoke-others',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: `Déconnexion des autres appareils (${closed.length})`,
      summaryEn: `Signed out of other devices (${closed.length})`,
    })
    return c.json({ ok: true, closed: closed.length })
  })

  .delete('/sessions/:id', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const closed = await db
      .delete(session)
      .where(and(eq(session.userId, actor.userId), eq(session.id, c.req.param('id'))))
      .returning({ id: session.id })
    if (!closed.length) return fail(c, 404, 'not_found')
    await audit(c, {
      action: 'session.revoke',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Une session fermée par la personne elle-même',
      summaryEn: 'A session closed by its owner',
    })
    return c.json({ ok: true })
  })
