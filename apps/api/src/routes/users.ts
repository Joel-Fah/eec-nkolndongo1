/**
 * Staff administration of accounts (Phase 02 §5.4): list, detail, edit, deactivate, roles with an optional
 * group scope, group memberships, sessions. Every mutation is permission-checked and audited.
 * Rights are re-read on every request, so a role change applies at once; on any role change the person's
 * sessions are also revoked (they sign in again with the new rights and the matching session lifetime).
 */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { type Db, schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, count, desc, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const { user, profiles, userRoles, roles, groups, groupMembers, session, auditLog, account } =
  schema

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.string().max(60).optional(),
  group: z.uuid().optional(),
  status: z.enum(['active', 'invited', 'deactivated']).optional(),
})
const patch = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  locale: z.enum(['fr', 'en']).optional(),
})
const grant = z.object({ roleKey: z.string().max(60), groupId: z.uuid().nullable().optional() })
const membership = z.object({ groupId: z.uuid(), titleFr: z.string().trim().max(80).optional() })

async function rolesOf(db: Db, ids: string[]) {
  if (!ids.length) return []
  return db
    .select({
      id: userRoles.id,
      userId: userRoles.userId,
      roleKey: roles.key,
      roleFr: roles.nameFr,
      roleEn: roles.nameEn,
      groupId: userRoles.groupId,
      groupFr: groups.nameFr,
      groupEn: groups.nameEn,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(groups, eq(groups.id, userRoles.groupId))
    .where(inArray(userRoles.userId, ids))
}

const isLastSuperAdmin = async (db: Db, userId: string) => {
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(profiles, eq(profiles.userId, userRoles.userId))
    .where(
      and(
        eq(roles.key, 'super-admin'),
        sql`${userRoles.groupId} is null`,
        eq(profiles.status, 'active'),
      ),
    )
  return rows.length === 1 && rows[0]?.userId === userId
}

const nameOf = async (db: Db, id: string) =>
  (await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, id)))[0]

export const userRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('core:users-read'), zValidator('query', listQuery), async (c) => {
    const { q, role, group, status } = c.req.valid('query')
    const db = await c.var.deps.db()
    const where: SQL[] = []
    if (q) where.push(or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)) as SQL)
    if (status) where.push(eq(profiles.status, status))
    if (role || group) {
      const sub = db
        .select({ id: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            role ? eq(roles.key, role) : undefined,
            group ? eq(userRoles.groupId, group) : undefined,
          ),
        )
      where.push(inArray(user.id, sub))
    }
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        status: profiles.status,
        lastSeenAt: profiles.lastSeenAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(user.createdAt))
      .limit(200)
    const grants = await rolesOf(
      db,
      rows.map((r) => r.id),
    )
    return c.json({
      users: rows.map((r) => ({ ...r, roles: grants.filter((g) => g.userId === r.id) })),
    })
  })

  .get('/:id', requirePermission('core:users-read'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const [row] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        phone: profiles.phone,
        locale: profiles.locale,
        status: profiles.status,
        lastSeenAt: profiles.lastSeenAt,
      })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, id))
    if (!row) return fail(c, 404, 'not_found')
    const [grants, memberships, sessions, activity, methods] = await Promise.all([
      rolesOf(db, [id]),
      db
        .select({
          groupId: groups.id,
          nameFr: groups.nameFr,
          nameEn: groups.nameEn,
          titleFr: groupMembers.titleFr,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(eq(groupMembers.userId, id)),
      db
        .select({
          id: session.id,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          userAgent: session.userAgent,
        })
        .from(session)
        .where(and(eq(session.userId, id), sql`${session.expiresAt} > now()`))
        .orderBy(desc(session.createdAt)),
      db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          summaryFr: auditLog.summaryFr,
          summaryEn: auditLog.summaryEn,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .where(or(eq(auditLog.actorId, id), eq(auditLog.entityId, id)))
        .orderBy(desc(auditLog.createdAt))
        .limit(20),
      db.select({ p: account.providerId }).from(account).where(eq(account.userId, id)),
    ])
    // How this person signs in (never the secrets): Google, e-mail and password, or both.
    const signIn = [
      ...new Set(
        methods.flatMap((m) =>
          m.p === 'google' ? ['google'] : m.p === 'credential' ? ['email'] : [],
        ),
      ),
    ]
    return c.json({ user: row, roles: grants, groups: memberships, sessions, activity, signIn })
  })

  .patch('/:id', requirePermission('core:users-update'), zValidator('json', patch), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const db = await c.var.deps.db()
    const target = await nameOf(db, id)
    if (!target) return fail(c, 404, 'not_found')
    const { name, ...profile } = body
    if (name) await db.update(user).set({ name }).where(eq(user.id, id))
    if (Object.keys(profile).length)
      await db.update(profiles).set(profile).where(eq(profiles.userId, id))
    await audit(c, {
      action: 'update',
      entityType: 'user',
      entityId: id,
      summaryFr: `Profil de ${target.email} modifié`,
      summaryEn: `Profile of ${target.email} updated`,
      diff: body,
    })
    return c.json({ ok: true })
  })

  .post('/:id/deactivate', requirePermission('core:users-deactivate'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    if (actor?.userId === id) return fail(c, 409, 'self')
    const target = await nameOf(db, id)
    if (!target) return fail(c, 404, 'not_found')
    if (await isLastSuperAdmin(db, id)) return fail(c, 409, 'last_super_admin')
    await db.update(profiles).set({ status: 'deactivated' }).where(eq(profiles.userId, id))
    await db.delete(session).where(eq(session.userId, id))
    await audit(c, {
      action: 'user.deactivate',
      entityType: 'user',
      entityId: id,
      summaryFr: `Compte de ${target.email} désactivé`,
      summaryEn: `Account of ${target.email} deactivated`,
    })
    return c.json({ ok: true })
  })

  .post('/:id/reactivate', requirePermission('core:users-deactivate'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const target = await nameOf(db, id)
    if (!target) return fail(c, 404, 'not_found')
    await db.update(profiles).set({ status: 'active' }).where(eq(profiles.userId, id))
    await audit(c, {
      action: 'user.reactivate',
      entityType: 'user',
      entityId: id,
      summaryFr: `Compte de ${target.email} réactivé`,
      summaryEn: `Account of ${target.email} reactivated`,
    })
    return c.json({ ok: true })
  })

  .post(
    '/:id/roles',
    requirePermission('core:roles-assign'),
    zValidator('json', grant),
    async (c) => {
      const id = c.req.param('id')
      const { roleKey, groupId } = c.req.valid('json')
      const db = await c.var.deps.db()
      const actor = await c.var.deps.actor()
      const target = await nameOf(db, id)
      if (!target) return fail(c, 404, 'not_found')
      const [role] = await db.select().from(roles).where(eq(roles.key, roleKey))
      if (!role) return fail(c, 400, 'unknown_role')
      // Granting Super admin is reserved to super admins.
      if (roleKey === 'super-admin' && !actor?.principal.isSuperAdmin)
        return fail(c, 403, 'forbidden')
      if (roleKey === 'super-admin' && groupId) return fail(c, 400, 'invalid')
      const [inserted] = await db
        .insert(userRoles)
        .values({
          userId: id,
          roleId: role.id,
          groupId: groupId ?? null,
          grantedBy: actor?.userId ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: userRoles.id })
      if (!inserted) return fail(c, 409, 'already_granted')
      await db.delete(session).where(eq(session.userId, id))
      await audit(c, {
        action: 'role.grant',
        entityType: 'user',
        entityId: id,
        summaryFr: `Rôle « ${role.nameFr} » attribué à ${target.email}`,
        summaryEn: `Role “${role.nameEn ?? role.nameFr}” granted to ${target.email}`,
        diff: { roleKey, groupId: groupId ?? null },
      })
      return c.json({ id: inserted.id }, 201)
    },
  )

  .delete('/:id/roles/:grantId', requirePermission('core:roles-assign'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [g] = await db
      .select({
        roleKey: roles.key,
        roleFr: roles.nameFr,
        roleEn: roles.nameEn,
        groupId: userRoles.groupId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.id, c.req.param('grantId')), eq(userRoles.userId, id)))
    if (!g) return fail(c, 404, 'not_found')
    if (g.roleKey === 'super-admin' && !actor?.principal.isSuperAdmin)
      return fail(c, 403, 'forbidden')
    try {
      await db.delete(userRoles).where(eq(userRoles.id, c.req.param('grantId')))
    } catch {
      // DB trigger: the last active super admin can't lose the role.
      return fail(c, 409, 'last_super_admin')
    }
    await db.delete(session).where(eq(session.userId, id))
    const target = await nameOf(db, id)
    await audit(c, {
      action: 'role.revoke',
      entityType: 'user',
      entityId: id,
      summaryFr: `Rôle « ${g.roleFr} » retiré à ${target?.email ?? id}`,
      summaryEn: `Role “${g.roleEn ?? g.roleFr}” removed from ${target?.email ?? id}`,
      diff: { roleKey: g.roleKey, groupId: g.groupId },
    })
    return c.json({ ok: true })
  })

  .post(
    '/:id/groups',
    requirePermission('core:groups-manage'),
    zValidator('json', membership),
    async (c) => {
      const id = c.req.param('id')
      const { groupId, titleFr } = c.req.valid('json')
      const db = await c.var.deps.db()
      const target = await nameOf(db, id)
      const [group] = await db.select().from(groups).where(eq(groups.id, groupId))
      if (!target || !group) return fail(c, 404, 'not_found')
      await db
        .insert(groupMembers)
        .values({ userId: id, groupId, titleFr: titleFr || null })
        .onConflictDoUpdate({
          target: [groupMembers.userId, groupMembers.groupId],
          set: { titleFr: titleFr || null },
        })
      await audit(c, {
        action: 'group.join',
        entityType: 'group',
        entityId: groupId,
        summaryFr: `${target.email} ajouté au groupe « ${group.nameFr} »`,
        summaryEn: `${target.email} added to the group “${group.nameEn ?? group.nameFr}”`,
      })
      return c.json({ ok: true }, 201)
    },
  )

  .delete('/:id/groups/:groupId', requirePermission('core:groups-manage'), async (c) => {
    const id = c.req.param('id')
    const groupId = c.req.param('groupId')
    const db = await c.var.deps.db()
    const removed = await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.userId, id), eq(groupMembers.groupId, groupId)))
      .returning({ userId: groupMembers.userId })
    if (!removed.length) return fail(c, 404, 'not_found')
    const target = await nameOf(db, id)
    await audit(c, {
      action: 'group.leave',
      entityType: 'group',
      entityId: groupId,
      summaryFr: `${target?.email ?? id} retiré d’un groupe`,
      summaryEn: `${target?.email ?? id} removed from a group`,
    })
    return c.json({ ok: true })
  })

  // Take Google off someone's account (a lost Gmail, a person who left) and close their sessions. They keep their password;
  // with none, they ask for a reset link.
  .delete('/:id/google', requirePermission('core:users-deactivate'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const target = await nameOf(db, id)
    if (!target) return fail(c, 404, 'not_found')
    const removed = await db
      .delete(account)
      .where(and(eq(account.userId, id), eq(account.providerId, 'google')))
      .returning({ id: account.id })
    if (!removed.length) return fail(c, 404, 'not_found')
    await db.delete(session).where(eq(session.userId, id))
    await audit(c, {
      action: 'google.unlink',
      entityType: 'user',
      entityId: id,
      summaryFr: `Compte Google de ${target.email} retiré (sessions fermées)`,
      summaryEn: `Google account of ${target.email} removed (sessions closed)`,
    })
    return c.json({ ok: true })
  })

  .delete('/:id/sessions', requirePermission('core:users-deactivate'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const [row] = await db.select({ value: count() }).from(session).where(eq(session.userId, id))
    const value = row?.value ?? 0
    await db.delete(session).where(eq(session.userId, id))
    const target = await nameOf(db, id)
    await audit(c, {
      action: 'session.revoke-all',
      entityType: 'user',
      entityId: id,
      summaryFr: `Toutes les sessions de ${target?.email ?? id} fermées (${value})`,
      summaryEn: `All sessions of ${target?.email ?? id} closed (${value})`,
    })
    return c.json({ ok: true, closed: value })
  })
