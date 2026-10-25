/**
 * In-app notifications (decision 0044): the signed-in person's own list, grouped by week on screen. Reminders are worked out
 * here when the list is read (no scheduler): each one is created once, closed by itself when the thing is done, and can be
 * read or hidden. Like « À faire », this reads other modules' tables by name; a switched-off module raises nothing.
 */
import { type AppEnv, requireSelf } from '@eec/api-kit'
import { can, type Principal } from '@eec/auth'
import { notifications } from '@eec/db/schema'
import { modules } from '@eec/modules'
import { isModuleEnabled } from '@eec/modules-kit'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { flagsFor } from './flags.ts'
import { type Done, dueSundays, pastSundays, weekOf } from './reminders.ts'

const WEEKS = 4
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
const KIND = 'sunday_report_due'

export const notificationRoutes = new Hono<AppEnv>()
  .get('/', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    const p = actor?.principal as Principal
    const me = actor?.userId as string
    const db = await c.var.deps.db()
    const sundaysModule = modules.find((m) => m.id === 'sundays')
    const flags = await flagsFor(c.var.deps.db, c.var.deps.timeoutMs)
    const may = {
      attendance: can(p, 'sundays:attendance'),
      offerings: can(p, 'sundays:offerings'),
    }
    if (
      sundaysModule &&
      isModuleEnabled(sundaysModule, flags) &&
      (may.attendance || may.offerings)
    ) {
      const days = pastSundays(todayLocal(), WEEKS)
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
      const due = dueSundays(
        days.filter((d) => !since || d >= since),
        done,
        may,
      )
      const mine = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, me), eq(notifications.kind, KIND)))
      const open = new Map(due.map((x) => [x.date, x]))
      for (const n of mine) {
        const now = open.get(n.ref)
        if (!now && !n.resolvedAt)
          await db
            .update(notifications)
            .set({ resolvedAt: new Date() })
            .where(eq(notifications.id, n.id))
        else if (now && (n.params as { what?: string }).what !== now.what)
          await db
            .update(notifications)
            .set({ params: { date: now.date, what: now.what }, readAt: null, resolvedAt: null })
            .where(eq(notifications.id, n.id))
      }
      const known = new Set(mine.map((n) => n.ref))
      const fresh = due.filter((x) => !known.has(x.date))
      if (fresh.length)
        await db
          .insert(notifications)
          .values(
            fresh.map((x) => ({
              userId: me,
              kind: KIND,
              ref: x.date,
              params: { date: x.date, what: x.what },
              href: `/m/sundays#${x.date}`,
              weekOf: weekOf(x.date),
            })),
          )
          .onConflictDoNothing()
    }
    const items = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, me), isNull(notifications.dismissedAt)))
      .orderBy(desc(notifications.weekOf), desc(notifications.ref))
      .limit(80)
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
      unread: items.filter((n) => !n.readAt && !n.resolvedAt).length,
    })
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
