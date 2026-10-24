/**
 * The signed-in person: who they are, what they may do, which modules are on (the admin builds its menu
 * from this), and Mon compte — profile, language and theme, password, sessions ("sign out everywhere").
 */
import { type AppEnv, audit, fail, requireSelf } from '@eec/api-kit'
import { checkPassword, isStaff } from '@eec/auth'
import { schema } from '@eec/db'
import { modules } from '@eec/modules'
import { isModuleEnabled } from '@eec/modules-kit'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { z } from 'zod'
import { currentPolicy, policyVersion } from '../policy.ts'
import { readFlags } from './flags.ts'

const { user, profiles, session, account, consents, groupMembers, groups, auditLog } = schema

/** How long a deletion request can still be cancelled (data-protection.md). */
export const DELETION_GRACE_DAYS = 30
const DAY = 86_400_000

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
  // Is the visitor a signed-in, active member (staff and super admin count)? Nothing else is said: for pages that are for members.
  .get('/membership', async (c) => {
    const actor = await c.var.deps.actor()
    c.header('cache-control', 'private, no-store')
    c.header('vary', 'Cookie')
    return c.json({ member: actor?.principal.status === 'active' })
  })
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

  // ── My data (Loi n°2024/017): what we keep, my choices, a copy, and deletion with a grace period ──
  .get('/privacy', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const rows = await db
      .select({
        kind: consents.kind,
        policyVersion: consents.policyVersion,
        grantedAt: consents.grantedAt,
        withdrawnAt: consents.withdrawnAt,
      })
      .from(consents)
      .where(eq(consents.userId, actor.userId))
      .orderBy(desc(consents.grantedAt))
    const [p] = await db
      .select({ at: profiles.deletionRequestedAt })
      .from(profiles)
      .where(eq(profiles.userId, actor.userId))
    const policy = await currentPolicy(db)
    // « La politique a changé »: shown when the last privacy consent is for an older version; asking to accept again
    // only when the purposes changed.
    const mine = rows.find((r) => r.kind === 'privacy' && !r.withdrawnAt)
    const changed = !!mine && mine.policyVersion !== policy.version && policy.publishedAt !== null
    return c.json({
      consents: rows,
      currentPolicy: policy.version,
      policyChange: changed
        ? {
            version: policy.version,
            summaryFr: policy.summaryFr,
            summaryEn: policy.summaryEn,
            mustAccept: policy.purposeChanged,
          }
        : null,
      deletionRequestedAt: p?.at ?? null,
      purgeOn: p?.at ? new Date(p.at.getTime() + DELETION_GRACE_DAYS * DAY) : null,
      graceDays: DELETION_GRACE_DAYS,
      canDelete: !isStaff(actor.principal),
    })
  })

  // Accepting the changed policy (only asked when the purposes changed): a new consent row for the new version.
  .post('/consents/privacy', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const version = await policyVersion(db)
    const [already] = await db
      .select({ id: consents.id })
      .from(consents)
      .where(
        and(
          eq(consents.userId, actor.userId),
          eq(consents.kind, 'privacy'),
          eq(consents.policyVersion, version),
        ),
      )
      .limit(1)
    if (!already)
      await db
        .insert(consents)
        .values({ userId: actor.userId, kind: 'privacy', policyVersion: version })
    await audit(c, {
      action: 'consent.grant',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Nouvelle politique de confidentialité acceptée',
      summaryEn: 'New privacy policy accepted',
    })
    return c.json({ ok: true })
  })

  // The optional consent (parish news later) can be given and withdrawn at any time; the history is kept.
  .post(
    '/consents/news',
    requireSelf(),
    zValidator('json', z.object({ granted: z.boolean() })),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const { granted } = c.req.valid('json')
      const db = await c.var.deps.db()
      const active = and(
        eq(consents.userId, actor.userId),
        eq(consents.kind, 'news'),
        sql`${consents.withdrawnAt} is null`,
      )
      if (granted) {
        const [already] = await db.select({ id: consents.id }).from(consents).where(active).limit(1)
        if (!already)
          await db
            .insert(consents)
            .values({ userId: actor.userId, kind: 'news', policyVersion: await policyVersion(db) })
      } else await db.update(consents).set({ withdrawnAt: new Date() }).where(active)
      await audit(c, {
        action: granted ? 'consent.grant' : 'consent.withdraw',
        entityType: 'account',
        entityId: actor.userId,
        summaryFr: granted
          ? 'Consentement aux nouvelles accordé'
          : 'Consentement aux nouvelles retiré',
        summaryEn: granted ? 'News consent given' : 'News consent withdrawn',
      })
      return c.json({ ok: true })
    },
  )

  // A copy of everything we hold about the person, as JSON (the right of access).
  .get('/export', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const [account_] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, actor.userId))
    const [profile] = await db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        phone: profiles.phone,
        locale: profiles.locale,
        theme: profiles.theme,
        status: profiles.status,
        deletionRequestedAt: profiles.deletionRequestedAt,
      })
      .from(profiles)
      .where(eq(profiles.userId, actor.userId))
    const myConsents = await db
      .select({
        kind: consents.kind,
        policyVersion: consents.policyVersion,
        grantedAt: consents.grantedAt,
        withdrawnAt: consents.withdrawnAt,
      })
      .from(consents)
      .where(eq(consents.userId, actor.userId))
    const myGroups = await db
      .select({
        key: groups.key,
        nameFr: groups.nameFr,
        nameEn: groups.nameEn,
        joinedAt: groupMembers.createdAt,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, actor.userId))
    const sessions = await db
      .select({
        startedAt: session.createdAt,
        expiresAt: session.expiresAt,
        device: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, actor.userId))
    const activity = await db
      .select({ at: auditLog.createdAt, action: auditLog.action, summary: auditLog.summaryFr })
      .from(auditLog)
      .where(eq(auditLog.actorId, actor.userId))
      .orderBy(desc(auditLog.createdAt))
      .limit(500)
    await audit(c, {
      action: 'data.export',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Copie des données personnelles téléchargée par la personne',
      summaryEn: 'Personal data copy downloaded by its owner',
    })
    const body = JSON.stringify(
      {
        generatedAt: new Date(),
        policyVersion: await policyVersion(db),
        account: account_,
        profile,
        consents: myConsents,
        groups: myGroups,
        sessions,
        activity,
      },
      null,
      2,
    )
    return new Response(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="mes-donnees-eec-nkolndongo1.json"',
        'cache-control': 'private, no-store',
      },
    })
  })

  // Deletion: asked here, cancellable for 30 days, then purged by the daily retention job.
  .post('/delete', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    // Team accounts are closed by a super admin (roles, audit trail and the last-super-admin rule).
    if (isStaff(actor.principal)) return fail(c, 403, 'staff_account')
    const db = await c.var.deps.db()
    const at = new Date()
    await db
      .update(profiles)
      .set({ deletionRequestedAt: at })
      .where(eq(profiles.userId, actor.userId))
    await audit(c, {
      action: 'account.deletion-requested',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: `Suppression du compte demandée (effective après ${DELETION_GRACE_DAYS} jours)`,
      summaryEn: `Account deletion requested (effective after ${DELETION_GRACE_DAYS} days)`,
    })
    return c.json({
      deletionRequestedAt: at,
      purgeOn: new Date(at.getTime() + DELETION_GRACE_DAYS * DAY),
    })
  })

  .delete('/delete', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    await db
      .update(profiles)
      .set({ deletionRequestedAt: null })
      .where(eq(profiles.userId, actor.userId))
    await audit(c, {
      action: 'account.deletion-cancelled',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Demande de suppression annulée',
      summaryEn: 'Deletion request cancelled',
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
