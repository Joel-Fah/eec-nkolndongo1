/**
 * In-app notifications (decision 0044): the signed-in person's own list, grouped by week on screen. Reminders are worked out
 * here when the list is read (no scheduler): each one is created once, closed by itself when the thing is done, and can be
 * read or hidden. Like « À faire », this reads other modules' tables by name; a switched-off module raises nothing.
 */
import { type AppEnv, requireSelf } from '@eec/api-kit'
import { can, canAnywhere, type Principal } from '@eec/auth'
import { notificationMutes, notifications } from '@eec/db/schema'
import { modules } from '@eec/modules'
import { isModuleEnabled } from '@eec/modules-kit'
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { flagsFor } from './flags.ts'
import { type Done, dueSundays, grew, pastSundays, type Rec, weekOf } from './reminders.ts'

const WEEKS = 4
/** The kinds a person can silence (decision 0046). */
export const KINDS = [
  'week_nudge',
  'sunday_report_due',
  'sunday_review',
  'campaign_review',
] as const
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())

export type Want = { ref: string; params: Record<string, unknown>; href: string; weekOf: string }
export type Db = Awaited<ReturnType<AppEnv['Variables']['deps']['db']>>

/** Brings one kind of notification in line with what is due now: creates the new, reopens the grown, closes the done. */
export async function sync(db: Db, me: string, kind: string, wants: Want[]) {
  const mine = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, me), eq(notifications.kind, kind)))
  const due = new Map(wants.map((w) => [w.ref, w]))
  for (const n of mine) {
    const now = due.get(n.ref)
    if (!now) {
      if (!n.resolvedAt)
        await db
          .update(notifications)
          .set({ resolvedAt: new Date() })
          .where(eq(notifications.id, n.id))
    } else if (n.resolvedAt || JSON.stringify(n.params) !== JSON.stringify(now.params)) {
      await db
        .update(notifications)
        .set({
          params: now.params,
          resolvedAt: null,
          ...(n.resolvedAt || grew(n.params as Rec, now.params as Rec) ? { readAt: null } : {}),
        })
        .where(eq(notifications.id, n.id))
    }
  }
  const known = new Set(mine.map((n) => n.ref))
  const fresh = wants.filter((w) => !known.has(w.ref))
  if (fresh.length)
    await db
      .insert(notifications)
      .values(fresh.map((w) => ({ userId: me, kind, ...w })))
      .onConflictDoNothing()
}
export const notificationRoutes = new Hono<AppEnv>()
  .get('/', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    const p = actor?.principal as Principal
    const me = actor?.userId as string
    const db = await c.var.deps.db()
    const flags = await flagsFor(c.var.deps.db, c.var.deps.timeoutMs)
    const on = (id: string) => {
      const m = modules.find((x) => x.id === id)
      return !!m && isModuleEnabled(m, flags)
    }
    const muted = new Set(
      (
        await db
          .select({ kind: notificationMutes.kind })
          .from(notificationMutes)
          .where(eq(notificationMutes.userId, me))
      ).map((m) => m.kind),
    )
    // A muted kind is neither raised nor shown, and does not count in the weekly summary.
    const run = (kind: string, wants: Want[]) =>
      muted.has(kind) ? Promise.resolve() : sync(db, me, kind, wants)
    const today = todayLocal()
    const week = weekOf(today)
    let reports: Want[] = []
    let reviews: Want[] = []
    let entries = 0

    const may = {
      attendance: can(p, 'sundays:attendance'),
      offerings: can(p, 'sundays:offerings'),
    }
    if (on('sundays') && (may.attendance || may.offerings)) {
      // 1. Sundays still to report on (the last four weeks).
      const days = pastSundays(today, WEEKS)
      const first = days.at(-1) as string
      const rows = await db.execute<{
        d: string
        attendance: boolean
        offerings: boolean
        closed: boolean
      }>(sql`select r.sunday_date as d,
          bool_or(r.attendance_at is not null) as attendance,
          bool_or(exists (select 1 from sunday_offerings o where o.report_id = r.id)) as offerings,
          bool_and(r.closed) as closed
        from sunday_reports r where r.sunday_date >= ${first} group by r.sunday_date`)
      const done = new Map<string, Done>(
        rows.rows.map((r) => [
          r.d,
          { attendance: r.attendance, offerings: r.offerings, closed: r.closed },
        ]),
      )
      // Only Sundays since the account existed (a new person is not told about the past).
      const since = (
        await db.execute<{ d: string }>(
          sql`select to_char(created_at at time zone 'Africa/Douala', 'YYYY-MM-DD') as d from "user" where id = ${me}`,
        )
      ).rows[0]?.d
      reports = dueSundays(
        days.filter((d) => !since || d >= since),
        done,
        may,
      ).map((x) => ({
        ref: x.date,
        params: { date: x.date, what: x.what },
        href: `/m/sundays#${x.date}`,
        weekOf: weekOf(x.date),
      }))
    }
    await run('sunday_report_due', reports)

    // 2. Figures a proposer entered, waiting for this person to validate them.
    if (on('sundays') && (may.attendance || may.offerings || canAnywhere(p, 'sundays:offerings'))) {
      const from = pastSundays(today, 8).at(-1) as string
      const rows = await db.execute<{ d: string; ap: boolean; groups: string[] | null }>(
        sql`select r.sunday_date as d, bool_or(r.attendance_pending) as ap,
            array_agg(distinct coalesce(o.group_id::text, '')) filter (where o.pending) as groups
          from sunday_reports r left join sunday_offerings o on o.report_id = r.id
          where r.sunday_date >= ${from} and not r.closed group by r.sunday_date`,
      )
      reviews = rows.rows
        .map((r) => ({
          date: r.d,
          attendance: r.ap && may.attendance,
          offerings: (r.groups ?? []).some((g) =>
            can(p, 'sundays:offerings', { groupId: g || null }),
          ),
        }))
        .filter((r) => r.attendance || r.offerings)
        .map((r) => ({
          ref: r.date,
          params: {
            date: r.date,
            what: r.attendance && r.offerings ? 'both' : r.attendance ? 'attendance' : 'offerings',
          },
          href: `/m/sundays#${r.date}`,
          weekOf: weekOf(r.date),
        }))
    }
    await run('sunday_review', reviews)

    // 3. Campaign entries waiting for validation: one notification a week while there are any.
    if (on('campaigns') && can(p, 'campaigns:validate')) {
      entries = Number(
        (
          await db.execute<{ n: number }>(
            sql`select count(*)::int as n from campaign_progress where validated = false`,
          )
        ).rows[0]?.n ?? 0,
      )
    }
    await run(
      'campaign_review',
      entries > 0
        ? [{ ref: week, params: { count: entries }, href: '/m/campaigns', weekOf: week }]
        : [],
    )

    // 4. The Monday nudge: one summary a week of everything above, until it is all done.
    const nr = muted.has('sunday_report_due') ? 0 : reports.length
    const nv = muted.has('sunday_review') ? 0 : reviews.length
    const ne = muted.has('campaign_review') ? 0 : entries
    const total = nr + nv + ne
    await run(
      'week_nudge',
      total > 0
        ? [
            {
              ref: week,
              params: { reports: nr, reviews: nv, entries: ne },
              href: nr + nv > 0 ? '/m/sundays' : '/m/campaigns',
              weekOf: week,
            },
          ]
        : [],
    )

    const items = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, me),
          inArray(notifications.kind, [...KINDS]),
          isNull(notifications.dismissedAt),
          muted.size ? notInArray(notifications.kind, [...muted]) : undefined,
        ),
      )
      .orderBy(desc(notifications.weekOf), desc(notifications.ref))
      .limit(80)
    // The count is its own query: the list is capped, the badge is not.
    const [counted] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, me),
          inArray(notifications.kind, [...KINDS]),
          isNull(notifications.readAt),
          isNull(notifications.resolvedAt),
          isNull(notifications.dismissedAt),
          muted.size ? notInArray(notifications.kind, [...muted]) : undefined,
        ),
      )
    const unread = counted?.n ?? 0
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
      unread,
      muted: [...muted],
    })
  })
  .put('/mute', requireSelf(), async (c) => {
    const p = z
      .object({ kind: z.enum(KINDS), muted: z.boolean() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: { code: 'invalid' } }, 400)
    const me = (await c.var.deps.actor())?.userId as string
    const db = await c.var.deps.db()
    if (p.data.muted)
      await db
        .insert(notificationMutes)
        .values({ userId: me, kind: p.data.kind })
        .onConflictDoNothing()
    else
      await db
        .delete(notificationMutes)
        .where(and(eq(notificationMutes.userId, me), eq(notificationMutes.kind, p.data.kind)))
    return c.json({ ok: true })
  })
  .post('/read', requireSelf(), async (c) => {
    const p = z
      .object({ ids: z.array(z.uuid()).max(100).optional(), all: z.boolean().optional() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: { code: 'invalid' } }, 400)
    const me = (await c.var.deps.actor())?.userId as string
    const db = await c.var.deps.db()
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, me),
          isNull(notifications.readAt),
          p.data.all ? undefined : inArray(notifications.id, p.data.ids ?? []),
        ),
      )
    return c.json({ ok: true })
  })
  .post('/dismiss', requireSelf(), async (c) => {
    const p = z
      .object({ ids: z.array(z.uuid()).min(1).max(100) })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: { code: 'invalid' } }, 400)
    const me = (await c.var.deps.actor())?.userId as string
    const db = await c.var.deps.db()
    await db
      .update(notifications)
      .set({ dismissedAt: new Date(), readAt: new Date() })
      .where(and(eq(notifications.userId, me), inArray(notifications.id, p.data.ids)))
    return c.json({ ok: true })
  })
