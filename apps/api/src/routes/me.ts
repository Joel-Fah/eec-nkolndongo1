/**
 * The signed-in person: who they are, what they may do, which modules are on (the admin builds its menu
 * from this), and Mon compte — profile, language and theme, password, sessions ("sign out everywhere").
 */
import { type AppEnv, audit, fail, requireSelf } from '@eec/api-kit'
import { allow, checkPassword, isStaff } from '@eec/auth'
import { adminBase } from '@eec/core'
import { schema } from '@eec/db'
import { modules } from '@eec/modules'
import { isModuleEnabled } from '@eec/modules-kit'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
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
const googleLink = z.object({ current: z.string().max(200).optional() })

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
    // Who is signed in must never come from a cache: a browser or proxy keeping this would show someone as signed in after they left.
    c.header('cache-control', 'private, no-store')
    c.header('vary', 'Cookie')
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
    // The role names (and the group of a scoped one), so the admin can say who you are here: « Responsable de groupe · Jeunesse ».
    const keys = [...new Set(p.grants.map((g) => g.roleKey))]
    const groupIds = [...new Set(p.grants.map((g) => g.groupId).filter((g): g is string => !!g))]
    const [roleRows, groupRows] = await Promise.all([
      keys.length
        ? db
            .select({ key: schema.roles.key, fr: schema.roles.nameFr, en: schema.roles.nameEn })
            .from(schema.roles)
            .where(inArray(schema.roles.key, keys))
        : [],
      groupIds.length
        ? db
            .select({ id: groups.id, fr: groups.nameFr, en: groups.nameEn })
            .from(groups)
            .where(inArray(groups.id, groupIds))
        : [],
    ])
    return c.json({
      user: row,
      isSuperAdmin: p.isSuperAdmin,
      // A staff member who has no password yet (decision 0053): the admin sends them to set one before anything else.
      needsPassword: !!p.needsPassword,
      roles: p.grants.map((g) => {
        const r = roleRows.find((x) => x.key === g.roleKey)
        const grp = groupRows.find((x) => x.id === g.groupId)
        return {
          role: g.roleKey,
          groupId: g.groupId,
          nameFr: r?.fr ?? g.roleKey,
          nameEn: r?.en ?? r?.fr ?? g.roleKey,
          groupFr: grp?.fr ?? null,
          groupEn: grp?.en ?? grp?.fr ?? null,
        }
      }),
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

  // Set a first password (decision 0053): for a staff member who only signs in with Google. Nobody who already has one:
  // they use "change password". Their other sessions are closed, like a change.
  .post(
    '/password/set',
    requireSelf(),
    zValidator('json', z.object({ next: z.string().max(200) })),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const db = await c.var.deps.db()
      if (!(await allow(db, `password-set:${actor.userId}`, 10, 3600)))
        return fail(c, 429, 'rate_limited')
      const { next } = c.req.valid('json')
      const problem = checkPassword(next)
      if (problem) return fail(c, 400, `password_${problem}` as 'password_too_short')
      const [have] = await db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, actor.userId), eq(account.providerId, 'credential')))
      if (have) return fail(c, 409, 'has_password')
      await db.insert(account).values({
        userId: actor.userId,
        accountId: actor.userId,
        providerId: 'credential',
        password: sql`eec_hash_password(${next})`,
      })
      const keep = await currentSessionId(c)
      await db
        .delete(session)
        .where(and(eq(session.userId, actor.userId), keep ? ne(session.id, keep) : undefined))
      await audit(c, {
        action: 'password.set',
        entityType: 'account',
        entityId: actor.userId,
        summaryFr: 'Premier mot de passe choisi (autres sessions fermées)',
        summaryEn: 'First password chosen (other sessions closed)',
      })
      return c.json({ ok: true })
    },
  )

  // Add Google to my own account (decision 0053): from a signed-in session only, with the password asked again when
  // there is one, so a stolen session cannot add someone else's Google. The Google address may differ from mine.
  .post('/google', requireSelf(), zValidator('json', googleLink), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET)
      return fail(c, 404, 'not_configured')
    const db = await c.var.deps.db()
    if (!(await allow(db, `google-link:${actor.userId}`, 6, 900)))
      return fail(c, 429, 'rate_limited')
    const rows = await db
      .select({ p: account.providerId, pw: account.password })
      .from(account)
      .where(eq(account.userId, actor.userId))
    if (rows.some((r) => r.p === 'google')) return fail(c, 409, 'already_linked')
    if (rows.some((r) => r.p === 'credential')) {
      const { current } = c.req.valid('json')
      const [ok] = await db
        .select({ ok: sql<boolean>`eec_verify_password(${current ?? ''}, ${account.password})` })
        .from(account)
        .where(and(eq(account.userId, actor.userId), eq(account.providerId, 'credential')))
      if (!ok?.ok) return fail(c, 400, 'invalid_credentials')
    }
    const admin = adminBase(c.env.ADMIN_PATH)
    const auth = await c.var.deps.auth()
    const res = await auth.api.linkSocialAccount({
      body: {
        provider: 'google',
        callbackURL: `${admin}account?google=linked`,
        errorCallbackURL: `${admin}account?google=error`,
        disableRedirect: true,
      },
      headers: c.req.raw.headers,
      asResponse: true,
    })
    if (!res.ok) return fail(c, 400, 'generic')
    const { url } = (await res.clone().json()) as { url?: string }
    if (!url) return fail(c, 400, 'generic')
    const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' })
    for (const cookie of res.headers.getSetCookie()) headers.append('set-cookie', cookie)
    return new Response(JSON.stringify({ url }), { status: 200, headers })
  })

  // Take Google off my account. Refused when it is my only way in: nobody locks themselves out.
  .delete('/google', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const rows = await db
      .select({ p: account.providerId })
      .from(account)
      .where(eq(account.userId, actor.userId))
    if (!rows.some((r) => r.p === 'google')) return fail(c, 404, 'not_found')
    if (!rows.some((r) => r.p === 'credential')) return fail(c, 409, 'only_sign_in')
    await db
      .delete(account)
      .where(and(eq(account.userId, actor.userId), eq(account.providerId, 'google')))
    await audit(c, {
      action: 'google.unlink',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Compte Google retiré par la personne elle-même',
      summaryEn: 'Google account removed by its owner',
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
        // The optional details (decision 0047): the right of access covers them too; the picture is not included, it is yours already.
        birthDate: profiles.birthDate,
        gender: profiles.gender,
        neighbourhood: profiles.neighbourhood,
        city: profiles.city,
        maritalStatus: profiles.maritalStatus,
        profession: profiles.profession,
        photoAsAvatar: profiles.photoAsAvatar,
        hasPhoto: sql<boolean>`${profiles.photoKey} is not null`,
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
