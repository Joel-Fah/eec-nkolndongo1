/**
 * Announcements API, mounted at /api/announcements. Group-scoped: a leader writes and publishes for their own group only; the group
 * is checked with `mayOn` once the announcement (or the body) says which one it is. Publishing raises a notification for each member.
 */
import { type AppEnv, audit, fail, mayOn, requirePermissionAnywhere } from '@eec/api-kit'
import { can, type Principal } from '@eec/auth'
import { groupMembers, groups, notifications } from '@eec/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { announcementsItems as items } from './schema.ts'

const uuid = /^[0-9a-f-]{36}$/
const link = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || v.startsWith('/') || /^https:\/\//.test(v), 'link')
  .default('')

export const itemBody = z
  .object({
    groupId: z.uuid(),
    titleFr: z.string().trim().min(2).max(100),
    titleEn: z.string().trim().max(100).default(''),
    bodyFr: z.string().trim().min(2).max(1000),
    bodyEn: z.string().trim().max(1000).default(''),
    linkUrl: link,
    /** The last day it shows (a day in Douala time); empty = until someone takes it down. */
    expiresOn: z.union([z.literal(''), z.iso.date()]).default(''),
  })
  .strict()

const mondayOf = (d: Date) =>
  new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10)

const row = (r: typeof items.$inferSelect) => ({
  id: r.id,
  groupId: r.groupId,
  titleFr: r.titleFr,
  titleEn: r.titleEn ?? '',
  bodyFr: r.bodyFr,
  bodyEn: r.bodyEn ?? '',
  linkUrl: r.linkUrl ?? '',
  state: r.state,
  publishedAt: r.publishedAt,
  expiresOn: r.expiresAt
    ? new Date(r.expiresAt.getTime() + 3_600_000).toISOString().slice(0, 10)
    : '',
  updatedAt: r.updatedAt,
})

export const announcementsApi = new Hono<AppEnv>()
  // The groups this person may read announcements for (all of them for the secretariat, their own for a leader).
  .get('/groups', requirePermissionAnywhere('announcements:read'), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const all = await db
      .select({
        id: groups.id,
        nameFr: groups.nameFr,
        nameEn: groups.nameEn,
        active: groups.isActive,
      })
      .from(groups)
      .orderBy(groups.nameFr)
    const p = actor.principal as Principal
    return c.json({
      groups: all
        .filter((g) => g.active && can(p, 'announcements:read', { groupId: g.id }))
        .map((g) => ({
          id: g.id,
          nameFr: g.nameFr,
          nameEn: g.nameEn,
          canEdit: can(p, 'announcements:edit', { groupId: g.id }),
          canPublish: can(p, 'announcements:publish', { groupId: g.id }),
        })),
    })
  })

  .get('/', requirePermissionAnywhere('announcements:read'), async (c) => {
    const groupId = c.req.query('groupId')
    if (!groupId || !uuid.test(groupId)) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'announcements:read', groupId))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const list = await db
      .select()
      .from(items)
      .where(eq(items.groupId, groupId))
      .orderBy(desc(items.updatedAt))
      .limit(100)
    return c.json({ items: list.map(row) })
  })

  .post('/', requirePermissionAnywhere('announcements:edit'), async (c) => {
    const parsed = itemBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const b = parsed.data
    if (!(await mayOn(c, 'announcements:edit', b.groupId))) return fail(c, 403, 'forbidden')
    const actor = await c.var.deps.actor()
    const db = await c.var.deps.db()
    const [created] = await db
      .insert(items)
      .values({
        groupId: b.groupId,
        titleFr: b.titleFr,
        titleEn: b.titleEn || null,
        bodyFr: b.bodyFr,
        bodyEn: b.bodyEn || null,
        linkUrl: b.linkUrl || null,
        expiresAt: b.expiresOn ? new Date(`${b.expiresOn}T23:59:59+01:00`) : null,
        createdBy: actor?.userId ?? null,
      })
      .returning({ id: items.id })
    if (!created) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'announcement.create',
      entityType: 'announcement',
      entityId: created.id,
      summaryFr: `Annonce « ${b.titleFr} » créée`,
      summaryEn: `Announcement “${b.titleEn || b.titleFr}” created`,
    })
    return c.json({ id: created.id }, 201)
  })

  .put('/:id', requirePermissionAnywhere('announcements:edit'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    const parsed = itemBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const b = parsed.data
    const db = await c.var.deps.db()
    const [before] = await db.select().from(items).where(eq(items.id, id))
    if (!before) return fail(c, 404, 'not_found')
    // The group of an announcement never changes; the right is checked on the one it has.
    if (before.groupId !== b.groupId) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'announcements:edit', before.groupId))) return fail(c, 403, 'forbidden')
    await db
      .update(items)
      .set({
        titleFr: b.titleFr,
        titleEn: b.titleEn || null,
        bodyFr: b.bodyFr,
        bodyEn: b.bodyEn || null,
        linkUrl: b.linkUrl || null,
        expiresAt: b.expiresOn ? new Date(`${b.expiresOn}T23:59:59+01:00`) : null,
      })
      .where(eq(items.id, id))
    await audit(c, {
      action: 'announcement.update',
      entityType: 'announcement',
      entityId: id,
      summaryFr: `Annonce « ${b.titleFr} » modifiée`,
      summaryEn: `Announcement “${b.titleEn || b.titleFr}” updated`,
    })
    return c.json({ ok: true })
  })

  // Publish: the announcement goes live and every member of the group gets a notification (once: a second publish adds none).
  .post('/:id/publish', requirePermissionAnywhere('announcements:publish'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [it] = await db.select().from(items).where(eq(items.id, id))
    if (!it) return fail(c, 404, 'not_found')
    if (!(await mayOn(c, 'announcements:publish', it.groupId))) return fail(c, 403, 'forbidden')
    const now = new Date()
    await db
      .update(items)
      .set({ state: 'published', publishedAt: it.publishedAt ?? now })
      .where(eq(items.id, id))
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, it.groupId))
    const [g] = await db
      .select({ nameFr: groups.nameFr, nameEn: groups.nameEn })
      .from(groups)
      .where(eq(groups.id, it.groupId))
    if (members.length)
      await db
        .insert(notifications)
        .values(
          members.map((m) => ({
            userId: m.userId,
            kind: 'group_announcement',
            ref: id,
            params: {
              title: `${g?.nameFr ?? ''} · ${it.titleFr}`,
              titleEn: `${g?.nameEn ?? g?.nameFr ?? ''} · ${it.titleEn ?? it.titleFr}`,
            },
            href: 'account:groupes',
            weekOf: mondayOf(now),
          })),
        )
        .onConflictDoNothing()
    await audit(c, {
      action: 'announcement.publish',
      entityType: 'announcement',
      entityId: id,
      summaryFr: `Annonce « ${it.titleFr} » publiée aux membres du groupe`,
      summaryEn: `Announcement “${it.titleEn ?? it.titleFr}” published to the group’s members`,
    })
    return c.json({ ok: true, notified: members.length })
  })

  // Take it down: it stops showing and its notifications are resolved.
  .post('/:id/expire', requirePermissionAnywhere('announcements:publish'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [it] = await db.select().from(items).where(eq(items.id, id))
    if (!it) return fail(c, 404, 'not_found')
    if (!(await mayOn(c, 'announcements:publish', it.groupId))) return fail(c, 403, 'forbidden')
    await db.update(items).set({ state: 'expired' }).where(eq(items.id, id))
    await db
      .update(notifications)
      .set({ resolvedAt: new Date() })
      .where(and(eq(notifications.kind, 'group_announcement'), eq(notifications.ref, id)))
    await audit(c, {
      action: 'announcement.expire',
      entityType: 'announcement',
      entityId: id,
      summaryFr: `Annonce « ${it.titleFr} » retirée`,
      summaryEn: `Announcement “${it.titleEn ?? it.titleFr}” taken down`,
    })
    return c.json({ ok: true })
  })

  .delete('/:id', requirePermissionAnywhere('announcements:edit'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [it] = await db.select().from(items).where(eq(items.id, id))
    if (!it) return fail(c, 404, 'not_found')
    if (!(await mayOn(c, 'announcements:edit', it.groupId))) return fail(c, 403, 'forbidden')
    await db.delete(items).where(eq(items.id, id))
    await db
      .delete(notifications)
      .where(and(eq(notifications.kind, 'group_announcement'), inArray(notifications.ref, [id])))
    await audit(c, {
      action: 'announcement.delete',
      entityType: 'announcement',
      entityId: id,
      summaryFr: `Annonce « ${it.titleFr} » supprimée`,
      summaryEn: `Announcement “${it.titleEn ?? it.titleFr}” deleted`,
    })
    return c.json({ ok: true })
  })
