/**
 * Sunday reports API, mounted at /api/sundays (decision 0043). Staff only; nothing is ever public.
 * Attendance (men, women, children) is entered by the secretariat; offering lines (purpose, amount, optional group) by the treasurer,
 * group leaders for their own group only. Aggregates only: no person, no donor. A « moissons » line may name a campaign and then keeps
 * ONE unvalidated entry there, which counts publicly only once the secretariat validates it (decision 0041).
 */
import {
  type AppEnv,
  audit,
  fail,
  mayOn,
  requirePermission,
  requirePermissionAnywhere,
} from '@eec/api-kit'
import { isPresetPurpose, purposeLabel } from '@eec/core'
import type { Db } from '@eec/db'
import { groups } from '@eec/db/schema'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  amountOk,
  attendanceTotal,
  byGroup,
  byPurpose,
  countOk,
  csvCell,
  isSundayDate,
  lastSunday,
  offeringsTotal,
  rollup,
} from './rules.ts'
import { sundayOfferings, sundayReports } from './schema.ts'

const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
const uuidRe = /^[0-9a-f-]{36}$/
const text = (max: number) => z.string().trim().max(max)

export const attendanceBody = z
  .object({
    men: z.number().int().min(0).max(100_000).nullable(),
    women: z.number().int().min(0).max(100_000).nullable(),
    children: z.number().int().min(0).max(100_000).nullable(),
    serviceKind: z.enum(['ordinary', 'special']),
    serviceLabel: text(80),
    // Internal; the form says it must not name anyone.
    note: text(120),
  })
  .partial()
  .strict()
export const offeringBody = z
  .object({
    purpose: text(60).min(1),
    amountXaf: z.number().int().min(1).max(500_000_000),
    groupId: z.uuid().nullable(),
    campaignId: z.uuid().nullable(),
  })
  .partial()
  .strict()

type Report = typeof sundayReports.$inferSelect
type Offering = typeof sundayOfferings.$inferSelect

async function getOrCreate(db: Db, date: string): Promise<Report> {
  const [row] = await db.select().from(sundayReports).where(eq(sundayReports.sundayDate, date))
  if (row) return row
  const [made] = await db
    .insert(sundayReports)
    .values({ sundayDate: date })
    .onConflictDoNothing()
    .returning()
  if (made) return made
  return (
    await db.select().from(sundayReports).where(eq(sundayReports.sundayDate, date))
  )[0] as Report
}

/** Lines the actor may see: all with a global right, otherwise only those of groups they may read. */
async function visibleLines(c: Parameters<typeof mayOn>[0], lines: Offering[]) {
  const out: Offering[] = []
  for (const l of lines) if (await mayOn(c, 'sundays:read', l.groupId)) out.push(l)
  return out
}

const dto = (r: Report, lines: Offering[], canAttendance: boolean) => ({
  id: r.id,
  date: r.sundayDate,
  // Attendance is parish-wide: a group-scoped person does not see it.
  men: canAttendance ? r.men : null,
  women: canAttendance ? r.women : null,
  children: canAttendance ? r.children : null,
  attendance: canAttendance ? attendanceTotal(r) : null,
  serviceKind: r.serviceKind,
  serviceLabel: r.serviceLabel,
  note: canAttendance ? r.note : '',
  closed: r.closed,
  closedAt: r.closedAt,
  offerings: offeringsTotal(lines),
  lines: lines.map((l) => ({
    id: l.id,
    purpose: l.purpose,
    amountXaf: l.amountXaf,
    groupId: l.groupId,
    campaignId: l.campaignId,
    linked: !!l.progressId,
  })),
})

/** Keeps the campaign entry of a Moissons line in step (raw SQL by table name: modules never import each other's internals). */
async function syncCampaign(
  db: Db,
  line: Offering,
  date: string,
  actorId: string | undefined,
): Promise<string | null> {
  const wants = line.purpose === 'moissons' && line.campaignId
  if (!wants) {
    if (line.progressId)
      await db.execute(
        sql`delete from campaign_progress where id = ${line.progressId} and validated = false`,
      )
    return null
  }
  const known = await db.execute(sql`select 1 from campaigns where id = ${line.campaignId}`)
  if (known.rows.length === 0) return line.progressId
  if (line.progressId) {
    // Any change takes the validation away: what was checked is no longer what is written.
    await db.execute(sql`update campaign_progress set amount_xaf = ${line.amountXaf}, group_id = ${line.groupId}, received_on = ${date},
      validated = case when amount_xaf = ${line.amountXaf} and group_id is not distinct from ${line.groupId} and received_on = ${date} then validated else false end,
      updated_at = now() where id = ${line.progressId}`)
    return line.progressId
  }
  const r =
    await db.execute(sql`insert into campaign_progress (campaign_id, group_id, amount_xaf, received_on, note, created_by)
    values (${line.campaignId}, ${line.groupId}, ${line.amountXaf}, ${date}, 'Bilan du dimanche', ${actorId ?? null}) returning id`)
  return (r.rows[0] as { id: string } | undefined)?.id ?? null
}

export const sundaysApi = new Hono<AppEnv>()
  // The Sunday to report on next, and the purposes already used (to suggest them again).
  .get('/hints', requirePermissionAnywhere('sundays:read'), async (c) => {
    const db = await c.var.deps.db()
    const used = await db
      .selectDistinct({ p: sundayOfferings.purpose })
      .from(sundayOfferings)
      .orderBy(asc(sundayOfferings.purpose))
    const campaigns = await db
      .execute(
        sql`select id, title_fr as title, starts_on, ends_on from campaigns order by starts_on desc limit 10`,
      )
      .catch(() => ({ rows: [] }))
    return c.json({
      lastSunday: lastSunday(todayLocal()),
      today: todayLocal(),
      custom: used.map((u) => u.p).filter((p) => !isPresetPurpose(p)),
      campaigns: campaigns.rows,
    })
  })
  .get('/reports', requirePermissionAnywhere('sundays:read'), async (c) => {
    const db = await c.var.deps.db()
    const from = c.req.query('from')
    const to = c.req.query('to')
    const reports = await db
      .select()
      .from(sundayReports)
      .where(
        and(
          from && /^\d{4}-\d{2}-\d{2}$/.test(from)
            ? gte(sundayReports.sundayDate, from)
            : undefined,
          to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? lte(sundayReports.sundayDate, to) : undefined,
        ),
      )
      .orderBy(desc(sundayReports.sundayDate))
      .limit(120)
    const lines = reports.length
      ? await db
          .select()
          .from(sundayOfferings)
          .where(
            inArray(
              sundayOfferings.reportId,
              reports.map((r) => r.id),
            ),
          )
      : []
    const canAttendance = await mayOn(c, 'sundays:read', null)
    const items = []
    for (const r of reports)
      items.push(
        dto(
          r,
          await visibleLines(
            c,
            lines.filter((l) => l.reportId === r.id),
          ),
          canAttendance,
        ),
      )
    return c.json({ items })
  })
  .get('/reports/:date', requirePermissionAnywhere('sundays:read'), async (c) => {
    const date = c.req.param('date')
    if (!isSundayDate(date)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [r] = await db.select().from(sundayReports).where(eq(sundayReports.sundayDate, date))
    // A Sunday that has no report yet is simply an empty one (nothing is created by looking).
    const empty = {
      id: '',
      sundayDate: date,
      men: null,
      women: null,
      children: null,
      serviceKind: 'ordinary',
      serviceLabel: '',
      note: '',
      closed: false,
      closedAt: null,
    } as unknown as Report
    const lines = r
      ? await db
          .select()
          .from(sundayOfferings)
          .where(eq(sundayOfferings.reportId, r.id))
          .orderBy(asc(sundayOfferings.createdAt))
      : []
    return c.json(
      dto(r ?? empty, await visibleLines(c, lines), await mayOn(c, 'sundays:read', null)),
    )
  })
  .put('/reports/:date/attendance', requirePermission('sundays:attendance'), async (c) => {
    const date = c.req.param('date')
    const p = attendanceBody.safeParse(await c.req.json().catch(() => null))
    if (!isSundayDate(date) || date > todayLocal() || !p.success) return fail(c, 400, 'invalid')
    for (const k of ['men', 'women', 'children'] as const)
      if (p.data[k] != null && !countOk(p.data[k])) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const r = await getOrCreate(db, date)
    if (r.closed) return fail(c, 409, 'closed')
    const actor = await c.var.deps.actor()
    await db
      .update(sundayReports)
      .set({
        ...p.data,
        attendanceBy: actor?.userId,
        attendanceAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sundayReports.id, r.id))
    // The audit line carries no figure.
    await audit(c, {
      action: 'update',
      entityType: 'sunday_report',
      entityId: r.id,
      summaryFr: 'Présences saisies',
      summaryEn: 'Attendance entered',
    })
    return c.json({ ok: true })
  })
  .post('/reports/:date/offerings', requirePermissionAnywhere('sundays:offerings'), async (c) => {
    const date = c.req.param('date')
    const p = offeringBody.safeParse(await c.req.json().catch(() => null))
    if (
      !isSundayDate(date) ||
      date > todayLocal() ||
      !p.success ||
      !p.data.purpose ||
      !amountOk(p.data.amountXaf)
    )
      return fail(c, 400, 'invalid')
    const groupId = p.data.groupId ?? null
    if (!(await mayOn(c, 'sundays:offerings', groupId))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const r = await getOrCreate(db, date)
    if (r.closed) return fail(c, 409, 'closed')
    const actor = await c.var.deps.actor()
    const purpose = p.data.purpose
    const [row] = await db
      .insert(sundayOfferings)
      .values({
        reportId: r.id,
        purpose,
        amountXaf: p.data.amountXaf,
        groupId,
        campaignId: purpose === 'moissons' ? (p.data.campaignId ?? null) : null,
        createdBy: actor?.userId,
      })
      .returning()
    if (!row) throw new Error('insert failed')
    const progressId = await syncCampaign(db, row, date, actor?.userId)
    if (progressId !== row.progressId)
      await db.update(sundayOfferings).set({ progressId }).where(eq(sundayOfferings.id, row.id))
    await audit(c, {
      action: 'create',
      entityType: 'sunday_offering',
      entityId: row.id,
      summaryFr: 'Offrande saisie',
      summaryEn: 'Offering entered',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/offerings/:id', requirePermissionAnywhere('sundays:offerings'), async (c) => {
    const id = c.req.param('id')
    const p = offeringBody.safeParse(await c.req.json().catch(() => null))
    if (!uuidRe.test(id) || !p.success) return fail(c, 400, 'invalid')
    if (p.data.amountXaf !== undefined && !amountOk(p.data.amountXaf))
      return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [cur] = await db.select().from(sundayOfferings).where(eq(sundayOfferings.id, id))
    const [rep] = cur
      ? await db.select().from(sundayReports).where(eq(sundayReports.id, cur.reportId))
      : []
    if (!cur || !rep || !(await mayOn(c, 'sundays:offerings', cur.groupId)))
      return fail(c, 404, 'not_found')
    if (p.data.groupId !== undefined && !(await mayOn(c, 'sundays:offerings', p.data.groupId)))
      return fail(c, 403, 'forbidden')
    if (rep.closed) return fail(c, 409, 'closed')
    const purpose = p.data.purpose ?? cur.purpose
    const next = {
      ...cur,
      ...p.data,
      purpose,
      campaignId:
        purpose === 'moissons'
          ? p.data.campaignId !== undefined
            ? p.data.campaignId
            : cur.campaignId
          : null,
    } as Offering
    const actor = await c.var.deps.actor()
    const progressId = await syncCampaign(db, next, rep.sundayDate, actor?.userId)
    await db
      .update(sundayOfferings)
      .set({
        purpose,
        amountXaf: next.amountXaf,
        groupId: next.groupId,
        campaignId: next.campaignId,
        progressId,
        updatedAt: new Date(),
      })
      .where(eq(sundayOfferings.id, id))
    await audit(c, {
      action: 'update',
      entityType: 'sunday_offering',
      entityId: id,
      summaryFr: 'Offrande modifiée',
      summaryEn: 'Offering edited',
    })
    return c.json({ ok: true })
  })
  .delete('/offerings/:id', requirePermissionAnywhere('sundays:offerings'), async (c) => {
    const id = c.req.param('id')
    if (!uuidRe.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [cur] = await db.select().from(sundayOfferings).where(eq(sundayOfferings.id, id))
    const [rep] = cur
      ? await db.select().from(sundayReports).where(eq(sundayReports.id, cur.reportId))
      : []
    if (!cur || !rep || !(await mayOn(c, 'sundays:offerings', cur.groupId)))
      return fail(c, 404, 'not_found')
    if (rep.closed) return fail(c, 409, 'closed')
    await syncCampaign(db, { ...cur, campaignId: null }, rep.sundayDate, undefined)
    await db.delete(sundayOfferings).where(eq(sundayOfferings.id, id))
    await audit(c, {
      action: 'delete',
      entityType: 'sunday_offering',
      entityId: id,
      summaryFr: 'Offrande supprimée',
      summaryEn: 'Offering deleted',
    })
    return c.json({ ok: true })
  })
  .post('/reports/:date/close', requirePermission('sundays:close'), async (c) => {
    const date = c.req.param('date')
    const p = z
      .object({ closed: z.boolean() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!isSundayDate(date) || !p.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const r = await getOrCreate(db, date)
    const actor = await c.var.deps.actor()
    await db
      .update(sundayReports)
      .set(
        p.data.closed
          ? { closed: true, closedBy: actor?.userId, closedAt: new Date() }
          : { closed: false, closedBy: null, closedAt: null },
      )
      .where(eq(sundayReports.id, r.id))
    await audit(c, {
      action: 'update',
      entityType: 'sunday_report',
      entityId: r.id,
      summaryFr: p.data.closed ? 'Dimanche clôturé' : 'Dimanche rouvert',
      summaryEn: p.data.closed ? 'Sunday closed' : 'Sunday reopened',
    })
    return c.json({ ok: true })
  })

  // Trends: by week or month, attendance and offerings by purpose, and by group over the range. Each person sees what they may.
  .get('/analytics', requirePermissionAnywhere('sundays:read'), async (c) => {
    const grain = c.req.query('grain') === 'week' ? 'week' : 'month'
    const today = todayLocal()
    const from = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('from') ?? '')
      ? (c.req.query('from') as string)
      : new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)
    const to = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('to') ?? '')
      ? (c.req.query('to') as string)
      : today
    const db = await c.var.deps.db()
    const reports = await db
      .select()
      .from(sundayReports)
      .where(and(gte(sundayReports.sundayDate, from), lte(sundayReports.sundayDate, to)))
      .orderBy(asc(sundayReports.sundayDate))
    const all = reports.length
      ? await db
          .select()
          .from(sundayOfferings)
          .where(
            inArray(
              sundayOfferings.reportId,
              reports.map((r) => r.id),
            ),
          )
      : []
    const canAttendance = await mayOn(c, 'sundays:read', null)
    const rows = []
    const flat = []
    for (const r of reports) {
      const lines = await visibleLines(
        c,
        all.filter((l) => l.reportId === r.id),
      )
      rows.push({
        date: r.sundayDate,
        men: canAttendance ? r.men : null,
        women: canAttendance ? r.women : null,
        children: canAttendance ? r.children : null,
        lines,
      })
      flat.push(...lines)
    }
    const names = new Map(
      (await db.select({ id: groups.id, fr: groups.nameFr }).from(groups)).map((g) => [g.id, g.fr]),
    )
    return c.json({
      grain,
      attendance: canAttendance,
      periods: rollup(rows, grain),
      purposes: byPurpose(flat).map((x) => ({ ...x, label: purposeLabel(x.purpose, 'fr') })),
      groups: byGroup(flat).map((x) => ({
        ...x,
        name: x.groupId ? (names.get(x.groupId) ?? '') : null,
      })),
    })
  })
  // CSV: dangerous (`export`), audited by row count only.
  .get('/export.csv', requirePermission('sundays:export'), async (c) => {
    const db = await c.var.deps.db()
    const reports = await db.select().from(sundayReports).orderBy(asc(sundayReports.sundayDate))
    const lines = reports.length ? await db.select().from(sundayOfferings) : []
    const names = new Map(
      (await db.select({ id: groups.id, fr: groups.nameFr }).from(groups)).map((g) => [g.id, g.fr]),
    )
    const head = [
      'Dimanche',
      'Hommes',
      'Femmes',
      'Enfants',
      'Total présents',
      'Type',
      'Objet',
      'Offrande (FCFA)',
      'Groupe',
    ]
    const rows: unknown[][] = []
    for (const r of reports) {
      const mine = lines.filter((l) => l.reportId === r.id)
      const base = [
        r.sundayDate,
        r.men,
        r.women,
        r.children,
        attendanceTotal(r),
        r.serviceLabel || (r.serviceKind === 'special' ? 'spécial' : 'ordinaire'),
      ]
      if (mine.length === 0) rows.push([...base, '', '', ''])
      for (const l of mine)
        rows.push([
          ...base,
          purposeLabel(l.purpose, 'fr'),
          l.amountXaf,
          l.groupId ? (names.get(l.groupId) ?? '') : 'Assemblée',
        ])
    }
    await audit(c, {
      action: 'export',
      entityType: 'sunday_report',
      entityId: 'all',
      summaryFr: `Bilans exportés (${rows.length} lignes)`,
      summaryEn: `Reports exported (${rows.length} rows)`,
      diff: { rows: rows.length },
    })
    c.header('content-type', 'text/csv; charset=utf-8')
    c.header('content-disposition', 'attachment; filename="bilans-dimanche.csv"')
    c.header('cache-control', 'no-store')
    return c.body(`﻿${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}`)
  })
