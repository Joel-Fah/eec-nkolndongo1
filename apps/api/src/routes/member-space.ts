/**
 * « Mon espace » for members (Phase 05, Checkpoint A): my groups, and my own notifications. Everything here is the signed-in person's own,
 * `private, no-store`. Staff have their own list (routes/notifications.ts); members get a lighter one with its own kinds. Joining a group
 * by request comes with decision 0049 (Checkpoint B); for now a member sees their groups and can leave one.
 */
import { type AppEnv, audit, fail, requireSelf } from '@eec/api-kit'
import { type Exception, nextOccurrence, preparationMonthOn, type Recurrence } from '@eec/core'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { currentPolicy } from '../policy.ts'
import { sync, type Want } from './notifications.ts'

const { groupMembers, groupRequests, groups, notifications, notificationMutes, consents } = schema

/** What can be raised for a member, and silenced by them (decision 0046 for the staff kinds). */
export const MEMBER_KINDS = [
  'waitlist_promoted',
  'policy_change',
  'group_announcement',
  'group_decision',
  'communion_reminder',
] as const

const mondayOf = (d: Date) =>
  new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10)

export const memberSpaceRoutes = new Hono<AppEnv>()
  // The groups I belong to, each with its next event (a repeating event counts through its next occurrence).
  .get('/groups', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    c.header('cache-control', 'private, no-store')
    const db = await c.var.deps.db()
    const mine = await db
      .select({
        id: groups.id,
        key: groups.key,
        nameFr: groups.nameFr,
        nameEn: groups.nameEn,
        kind: groups.kind,
        titleFr: groupMembers.titleFr,
        titleEn: groupMembers.titleEn,
        sharePhone: groupMembers.sharePhone,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.userId, actor.userId), eq(groups.isActive, true)))
      .orderBy(groups.nameFr)
    const ids = mine.map((g) => g.id)
    const events = ids.length
      ? await db.execute<{
          group_id: string
          slug: string
          title_fr: string
          title_en: string
          starts_at: Date
          ends_at: Date | null
          all_day: boolean
          timezone: string
          recurrence: Recurrence | null
          exceptions: Exception[] | null
        }>(
          sql`select group_id, slug, title_fr, title_en, starts_at, ends_at, all_day, timezone, recurrence, exceptions
              from events_items where state = 'published' and (publish_at is null or publish_at <= now()) and group_id in (${sql.join(
                ids.map((i) => sql`${i}::uuid`),
                sql`, `,
              )})`,
        )
      : { rows: [] }
    const now = new Date()
    const next = new Map<
      string,
      { slug: string; titleFr: string; titleEn: string; startsAt: Date }
    >()
    for (const e of events.rows) {
      const occ = nextOccurrence(
        {
          startsAt: new Date(e.starts_at),
          endsAt: e.ends_at ? new Date(e.ends_at) : null,
          allDay: e.all_day,
          timezone: e.timezone,
          recurrence: e.recurrence,
          exceptions: e.exceptions ?? [],
        },
        now,
      )
      if (!occ) continue
      const cur = next.get(e.group_id)
      if (!cur || occ.startsAt < cur.startsAt)
        next.set(e.group_id, {
          slug: e.slug,
          titleFr: e.title_fr,
          titleEn: e.title_en,
          startsAt: occ.startsAt,
        })
    }
    // The latest announcements of my groups (published, not past their last day), three per group at most.
    const anns = ids.length
      ? await db.execute<{
          id: string
          group_id: string
          title_fr: string
          title_en: string | null
          body_fr: string
          body_en: string | null
          link_url: string | null
          published_at: Date
        }>(
          sql`select id, group_id, title_fr, title_en, body_fr, body_en, link_url, published_at
              from announcements_items
              where state = 'published' and (expires_at is null or expires_at > now()) and group_id in (${sql.join(
                ids.map((i) => sql`${i}::uuid`),
                sql`, `,
              )})
              order by published_at desc limit 30`,
        )
      : { rows: [] }
    const pending = await db
      .select({
        id: groupRequests.id,
        groupId: groups.id,
        nameFr: groups.nameFr,
        nameEn: groups.nameEn,
        requestedAt: groupRequests.requestedAt,
      })
      .from(groupRequests)
      .innerJoin(groups, eq(groups.id, groupRequests.groupId))
      .where(and(eq(groupRequests.userId, actor.userId), eq(groupRequests.status, 'pending')))
    return c.json({
      items: mine.map((g) => ({
        ...g,
        next: next.get(g.id) ?? null,
        announcements: anns.rows
          .filter((a) => a.group_id === g.id)
          .slice(0, 3)
          .map((a) => ({
            id: a.id,
            titleFr: a.title_fr,
            titleEn: a.title_en ?? a.title_fr,
            bodyFr: a.body_fr,
            bodyEn: a.body_en ?? a.body_fr,
            link: a.link_url,
            publishedAt: a.published_at,
          })),
      })),
      pending,
    })
  })
  // The active groups I am not in, to ask to join one. My last answer (accepted or not) shows with its message.
  .get('/groups/directory', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    c.header('cache-control', 'private, no-store')
    const db = await c.var.deps.db()
    const [all, mine, reqs] = await Promise.all([
      db.select().from(groups).where(eq(groups.isActive, true)).orderBy(groups.nameFr),
      db
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(eq(groupMembers.userId, actor.userId)),
      db
        .select()
        .from(groupRequests)
        .where(eq(groupRequests.userId, actor.userId))
        .orderBy(desc(groupRequests.requestedAt)),
    ])
    const inGroup = new Set(mine.map((m) => m.groupId))
    return c.json({
      items: all
        .filter((g) => !inGroup.has(g.id))
        .map((g) => {
          const last = reqs.find((r) => r.groupId === g.id)
          return {
            id: g.id,
            nameFr: g.nameFr,
            nameEn: g.nameEn,
            kind: g.kind,
            descriptionFr: g.descriptionFr,
            descriptionEn: g.descriptionEn,
            request: last
              ? { id: last.id, status: last.status, message: last.decisionMessage }
              : null,
          }
        }),
    })
  })
  .post(
    '/groups/:id/request',
    requireSelf(),
    zValidator('json', z.object({ sharePhone: z.boolean() }).strict()),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const id = c.req.param('id')
      if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 400, 'invalid')
      const db = await c.var.deps.db()
      const [g] = await db
        .select()
        .from(groups)
        .where(and(eq(groups.id, id), eq(groups.isActive, true)))
      if (!g) return fail(c, 404, 'not_found')
      const [already] = await db
        .select({ u: groupMembers.userId })
        .from(groupMembers)
        .where(and(eq(groupMembers.userId, actor.userId), eq(groupMembers.groupId, id)))
      if (already) return fail(c, 409, 'already_member')
      const [waiting] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(groupRequests)
        .where(and(eq(groupRequests.userId, actor.userId), eq(groupRequests.status, 'pending')))
      if ((waiting?.n ?? 0) >= 5) return fail(c, 429, 'rate_limited')
      const inserted = await db
        .insert(groupRequests)
        .values({ userId: actor.userId, groupId: id, sharePhone: c.req.valid('json').sharePhone })
        .onConflictDoNothing()
        .returning({ id: groupRequests.id })
      if (!inserted.length) return fail(c, 409, 'already_requested')
      await audit(c, {
        action: 'group.request.create',
        entityType: 'group',
        entityId: id,
        summaryFr: 'Demande pour rejoindre un groupe',
        summaryEn: 'Request to join a group',
      })
      return c.json({ ok: true }, 201)
    },
  )
  .delete('/groups/requests/:rid', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const rid = c.req.param('rid')
    if (!/^[0-9a-f-]{36}$/.test(rid)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    await db
      .update(groupRequests)
      .set({ status: 'withdrawn', decidedAt: new Date() })
      .where(
        and(
          eq(groupRequests.id, rid),
          eq(groupRequests.userId, actor.userId),
          eq(groupRequests.status, 'pending'),
        ),
      )
    return c.json({ ok: true })
  })
  // Share, or stop sharing, my phone number with the leaders of a group I am in.
  .put(
    '/groups/:id/share-phone',
    requireSelf(),
    zValidator('json', z.object({ sharePhone: z.boolean() }).strict()),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const id = c.req.param('id')
      if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 400, 'invalid')
      const db = await c.var.deps.db()
      await db
        .update(groupMembers)
        .set({ sharePhone: c.req.valid('json').sharePhone })
        .where(and(eq(groupMembers.userId, actor.userId), eq(groupMembers.groupId, id)))
      return c.json({ ok: true })
    },
  )
  // Leaving is immediate. Nothing is kept about it.
  .delete('/groups/:id', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.userId, actor.userId), eq(groupMembers.groupId, id)))
    await audit(c, {
      action: 'delete',
      entityType: 'account',
      entityId: actor.userId,
      summaryFr: 'Groupe quitté par la personne',
      summaryEn: 'Group left by its owner',
    })
    return c.json({ ok: true })
  })

  // ——— My notifications ———————————————————————————————————————————————
  .get('/notifications', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    c.header('cache-control', 'private, no-store')
    const me = actor.userId
    const db = await c.var.deps.db()
    const muted = new Set(
      (
        await db
          .select({ kind: notificationMutes.kind })
          .from(notificationMutes)
          .where(eq(notificationMutes.userId, me))
      ).map((m) => m.kind),
    )
    // The privacy policy changed since this person last accepted: raised here, resolved when they accept (or when nothing changed).
    const policy = await currentPolicy(db)
    const [accepted] = await db
      .select({ v: consents.policyVersion })
      .from(consents)
      .where(
        and(eq(consents.userId, me), eq(consents.kind, 'privacy'), isNull(consents.withdrawnAt)),
      )
      .orderBy(desc(consents.grantedAt))
      .limit(1)
    const changed: Want[] =
      policy.publishedAt && accepted && accepted.v !== policy.version
        ? [
            {
              ref: policy.version,
              params: { version: policy.version, mustAccept: policy.purposeChanged },
              href: 'account:profil',
              weekOf: mondayOf(new Date()),
            },
          ]
        : []
    if (!muted.has('policy_change')) await sync(db, me, 'policy_change', changed)
    // The preparation week is on and my card has no visa for the month and no excuse: a reminder, resolved as soon as it is signed or excused.
    if (!muted.has('communion_reminder')) {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
      const prep = preparationMonthOn(day)
      let due: Want[] = []
      if (prep) {
        const r = await db.execute<{ ok: boolean }>(
          sql`select (c.status = 'active' and c.valid_until >= ${day}::date
              and not exists (select 1 from communion_visas v where v.card_id = c.id and v.month = ${prep})
              and not exists (select 1 from communion_excuses e where e.card_id = c.id and e.month = ${prep})) as ok
            from communion_cards c where c.user_id = ${me}`,
        )
        if (r.rows[0]?.ok)
          due = [
            {
              ref: prep,
              params: {
                title:
                  'La semaine de préparation de la Sainte-Cène est en cours : pensez à faire viser votre carte avant dimanche.',
                titleEn:
                  'The Holy Supper preparation week is on: remember to have your card signed before Sunday.',
              },
              href: 'account:accueil',
              weekOf: mondayOf(new Date()),
            },
          ]
      }
      await sync(db, me, 'communion_reminder', due)
    }
    const hide = muted.size ? notInArray(notifications.kind, [...muted]) : undefined
    const items = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, me),
          inArray(notifications.kind, [...MEMBER_KINDS]),
          isNull(notifications.dismissedAt),
          hide,
        ),
      )
      .orderBy(desc(notifications.weekOf), desc(notifications.createdAt))
      .limit(60)
    const [counted] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, me),
          inArray(notifications.kind, [...MEMBER_KINDS]),
          isNull(notifications.readAt),
          isNull(notifications.resolvedAt),
          isNull(notifications.dismissedAt),
          hide,
        ),
      )
    return c.json({
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        params: n.params,
        href: n.href,
        weekOf: n.weekOf,
        read: !!n.readAt,
        resolved: !!n.resolvedAt,
        createdAt: n.createdAt,
      })),
      unread: counted?.n ?? 0,
      muted: [...muted].filter((k) => (MEMBER_KINDS as readonly string[]).includes(k)),
    })
  })
  .post(
    '/notifications/read',
    requireSelf(),
    zValidator(
      'json',
      z
        .object({ ids: z.array(z.uuid()).max(100).optional(), all: z.boolean().optional() })
        .strict(),
    ),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const body = c.req.valid('json')
      const db = await c.var.deps.db()
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, actor.userId),
            isNull(notifications.readAt),
            inArray(notifications.kind, [...MEMBER_KINDS]),
            body.all ? undefined : inArray(notifications.id, body.ids ?? []),
          ),
        )
      return c.json({ ok: true })
    },
  )
  .post(
    '/notifications/dismiss',
    requireSelf(),
    zValidator('json', z.object({ ids: z.array(z.uuid()).min(1).max(100) }).strict()),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const db = await c.var.deps.db()
      await db
        .update(notifications)
        .set({ dismissedAt: new Date(), readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, actor.userId),
            inArray(notifications.id, c.req.valid('json').ids),
          ),
        )
      return c.json({ ok: true })
    },
  )
  .put(
    '/notifications/mute',
    requireSelf(),
    zValidator('json', z.object({ kind: z.enum(MEMBER_KINDS), muted: z.boolean() }).strict()),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      const { kind, muted } = c.req.valid('json')
      const db = await c.var.deps.db()
      if (muted)
        await db
          .insert(notificationMutes)
          .values({ userId: actor.userId, kind })
          .onConflictDoNothing()
      else
        await db
          .delete(notificationMutes)
          .where(and(eq(notificationMutes.userId, actor.userId), eq(notificationMutes.kind, kind)))
      return c.json({ ok: true })
    },
  )
