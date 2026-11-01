/**
 * « Mon groupe » (decision 0049): what a group's leaders (and the secretariat) see and do for their own group: the roster, the requests to join,
 * a few figures, removals and the audited export. Every route names the group and checks the right *for that group* (`mayOn`): a leader of
 * one group sees nothing of another. Names, avatars and a phone number only if its owner shared it with this group.
 */
import { type AppEnv, audit, fail, mayOn, requirePermissionAnywhere } from '@eec/api-kit'
import { can, type Principal } from '@eec/auth'
import { ageBand, avatarSeed } from '@eec/core'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, asc, count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { bandCounts, csvCell, visiblePhone } from '../lib/group-space.ts'
import { photoResponse } from './profile.ts'

const { groups, groupMembers, groupRequests, user, profiles, notifications } = schema
const uuid = /^[0-9a-f-]{36}$/
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
const mondayOf = (d: Date) =>
  new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10)

export const groupSpaceRoutes = new Hono<AppEnv>()
  // The groups this person may follow (all of them for the secretariat, their own for a leader), with the numbers that matter.
  .get('/mine', requirePermissionAnywhere('core:group-roster'), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    c.header('cache-control', 'private, no-store')
    const db = await c.var.deps.db()
    const p = actor.principal as Principal
    const [all, members, pending] = await Promise.all([
      db.select().from(groups).where(eq(groups.isActive, true)).orderBy(asc(groups.nameFr)),
      db
        .select({ groupId: groupMembers.groupId, n: count() })
        .from(groupMembers)
        .groupBy(groupMembers.groupId),
      db
        .select({ groupId: groupRequests.groupId, n: count() })
        .from(groupRequests)
        .where(eq(groupRequests.status, 'pending'))
        .groupBy(groupRequests.groupId),
    ])
    return c.json({
      groups: all
        .filter((g) => can(p, 'core:group-roster', { groupId: g.id }))
        .map((g) => ({
          id: g.id,
          nameFr: g.nameFr,
          nameEn: g.nameEn,
          kind: g.kind,
          members: members.find((m) => m.groupId === g.id)?.n ?? 0,
          pending: pending.find((m) => m.groupId === g.id)?.n ?? 0,
          canManage: can(p, 'core:group-members', { groupId: g.id }),
          canExport: can(p, 'core:group-export', { groupId: g.id }),
        })),
    })
  })

  .get('/:id', requirePermissionAnywhere('core:group-roster'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'core:group-roster', id))) return fail(c, 403, 'forbidden')
    c.header('cache-control', 'private, no-store')
    const db = await c.var.deps.db()
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    if (!group) return fail(c, 404, 'not_found')
    const rows = await db
      .select({
        userId: user.id,
        name: user.name,
        image: user.image,
        photoKey: profiles.photoKey,
        phone: profiles.phone,
        birthDate: profiles.birthDate,
        titleFr: groupMembers.titleFr,
        titleEn: groupMembers.titleEn,
        sharePhone: groupMembers.sharePhone,
        joinedAt: groupMembers.createdAt,
      })
      .from(groupMembers)
      .innerJoin(user, eq(user.id, groupMembers.userId))
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(user.name))
    const requests = await db
      .select({
        id: groupRequests.id,
        userId: user.id,
        name: user.name,
        requestedAt: groupRequests.requestedAt,
        sharePhone: groupRequests.sharePhone,
      })
      .from(groupRequests)
      .innerJoin(user, eq(user.id, groupRequests.userId))
      .where(and(eq(groupRequests.groupId, id), eq(groupRequests.status, 'pending')))
      .orderBy(asc(groupRequests.requestedAt))
    const now = today()
    const monthStart = `${now.slice(0, 7)}-01`
    return c.json({
      group: { id: group.id, nameFr: group.nameFr, nameEn: group.nameEn },
      canManage: await mayOn(c, 'core:group-members', id),
      canExport: await mayOn(c, 'core:group-export', id),
      members: rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        seed: avatarSeed(r.userId),
        // The team always sees the picture the person added (decision 0047); through a route that checks this group.
        photoUrl: r.photoKey
          ? `/api/group-space/${id}/members/${r.userId}/photo`
          : (r.image ?? null),
        titleFr: r.titleFr,
        titleEn: r.titleEn,
        joinedAt: r.joinedAt,
        phone: visiblePhone(r.sharePhone, r.phone),
      })),
      requests,
      stats: {
        members: rows.length,
        joinsThisMonth: rows.filter((r) => r.joinedAt.toISOString().slice(0, 10) >= monthStart)
          .length,
        ageBands: bandCounts(rows.map((r) => ageBand(r.birthDate, now))),
      },
    })
  })

  // The picture of one member of this group (never through members:read, which is parish-wide).
  .get('/:id/members/:userId/photo', requirePermissionAnywhere('core:group-roster'), async (c) => {
    const { id, userId } = c.req.param()
    if (!uuid.test(id) || !uuid.test(userId)) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'core:group-roster', id))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const [row] = await db
      .select({ key: profiles.photoKey })
      .from(groupMembers)
      .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, userId)))
    if (!row?.key) return fail(c, 404, 'not_found')
    return photoResponse(c.env, row.key)
  })

  .post(
    '/requests/:rid/decide',
    requirePermissionAnywhere('core:group-members'),
    zValidator(
      'json',
      z.object({ approve: z.boolean(), message: z.string().trim().max(300).default('') }).strict(),
    ),
    async (c) => {
      const rid = c.req.param('rid')
      if (!uuid.test(rid)) return fail(c, 400, 'invalid')
      const { approve, message } = c.req.valid('json')
      const db = await c.var.deps.db()
      const [req] = await db.select().from(groupRequests).where(eq(groupRequests.id, rid))
      if (!req) return fail(c, 404, 'not_found')
      if (!(await mayOn(c, 'core:group-members', req.groupId))) return fail(c, 403, 'forbidden')
      if (req.status !== 'pending') return fail(c, 409, 'already_decided')
      const actor = await c.var.deps.actor()
      const [g] = await db.select().from(groups).where(eq(groups.id, req.groupId))
      const now = new Date()
      await db
        .update(groupRequests)
        .set({
          status: approve ? 'approved' : 'declined',
          decidedBy: actor?.userId ?? null,
          decidedAt: now,
          decisionMessage: message || null,
        })
        .where(eq(groupRequests.id, rid))
      if (approve)
        await db
          .insert(groupMembers)
          .values({ userId: req.userId, groupId: req.groupId, sharePhone: req.sharePhone })
          .onConflictDoNothing()
      const name = g?.nameFr ?? ''
      const nameEn = g?.nameEn ?? name
      await db
        .insert(notifications)
        .values({
          userId: req.userId,
          kind: 'group_decision',
          ref: rid,
          params: {
            approved: approve,
            title: approve
              ? `Votre demande pour « ${name} » a été acceptée.${message ? ` ${message}` : ''}`
              : `Votre demande pour « ${name} » n’a pas été retenue.${message ? ` ${message}` : ''}`,
            titleEn: approve
              ? `Your request to join “${nameEn}” was accepted.${message ? ` ${message}` : ''}`
              : `Your request to join “${nameEn}” was not accepted.${message ? ` ${message}` : ''}`,
          },
          href: 'account:groupes',
          weekOf: mondayOf(now),
        })
        .onConflictDoNothing()
      await audit(c, {
        action: approve ? 'group.request.approve' : 'group.request.decline',
        entityType: 'group',
        entityId: req.groupId,
        summaryFr: `Demande pour rejoindre « ${name} » ${approve ? 'acceptée' : 'refusée'}`,
        summaryEn: `Request to join “${nameEn}” ${approve ? 'accepted' : 'declined'}`,
      })
      return c.json({ ok: true })
    },
  )

  // Removing someone: the reason stays in the activity log only, never shown to the person or the public.
  .delete(
    '/:id/members/:userId',
    requirePermissionAnywhere('core:group-members'),
    zValidator('json', z.object({ reason: z.string().trim().min(3).max(300) }).strict()),
    async (c) => {
      const { id, userId } = c.req.param()
      if (!uuid.test(id) || !uuid.test(userId)) return fail(c, 400, 'invalid')
      if (!(await mayOn(c, 'core:group-members', id))) return fail(c, 403, 'forbidden')
      const db = await c.var.deps.db()
      const gone = await db
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, userId)))
        .returning({ userId: groupMembers.userId })
      if (!gone.length) return fail(c, 404, 'not_found')
      const [g] = await db.select().from(groups).where(eq(groups.id, id))
      await audit(c, {
        action: 'group.member.remove',
        entityType: 'group',
        entityId: id,
        summaryFr: `Membre retiré du groupe « ${g?.nameFr ?? ''} »`,
        summaryEn: `Member removed from group “${g?.nameEn ?? g?.nameFr ?? ''}”`,
        diff: { userId, reason: c.req.valid('json').reason },
      })
      return c.json({ ok: true })
    },
  )

  // The list of one group as a file: a dangerous right, limited to the group, every export logged.
  .get('/:id/export', requirePermissionAnywhere('core:group-export'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'core:group-export', id))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const [g] = await db.select().from(groups).where(eq(groups.id, id))
    if (!g) return fail(c, 404, 'not_found')
    const rows = await db
      .select({
        name: user.name,
        phone: profiles.phone,
        sharePhone: groupMembers.sharePhone,
        titleFr: groupMembers.titleFr,
        joinedAt: groupMembers.createdAt,
      })
      .from(groupMembers)
      .innerJoin(user, eq(user.id, groupMembers.userId))
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(user.name))
    await audit(c, {
      action: 'export',
      entityType: 'group',
      entityId: id,
      summaryFr: `Export CSV du groupe « ${g.nameFr} » (${rows.length} personne(s))`,
      summaryEn: `Group “${g.nameEn ?? g.nameFr}” exported as CSV (${rows.length} person(s))`,
      diff: { rows: rows.length },
    })
    const head = ['name', 'role', 'joined', 'phone']
    const lines = rows.map((r) =>
      [r.name, r.titleFr, r.joinedAt, visiblePhone(r.sharePhone, r.phone)].map(csvCell).join(','),
    )
    return new Response(`﻿${[head.join(','), ...lines].join('\r\n')}\r\n`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="groupe-${g.key}-${today()}.csv"`,
        'cache-control': 'private, no-store',
      },
    })
  })
