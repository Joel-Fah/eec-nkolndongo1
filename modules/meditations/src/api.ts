/**
 * Meditations API, mounted at /api/meditations.
 * - Staff: plans (create, dates, publish), the days of a plan (edit one, import a CSV calendar in bulk).
 * - Public (edge-cached): a day (today by default), a month, and the whole plan in compact form (for « Ajouter au calendrier »).
 * Passages are references only; a verse text exists only where staff typed it on purpose, in LSG 1910 / WEB (decision 0032).
 */
import {
  type AppEnv,
  audit,
  bumpContentVersion,
  cachedJson,
  fail,
  requirePermission,
  versionFor,
} from '@eec/api-kit'
import {
  checkPassage,
  checkPsalm,
  defaultLabel,
  formatPassage,
  formatPsalm,
  parsePassage,
  parsePsalm,
  parseStructured,
  READING_LABELS,
  slugify,
  uniqueSlug,
} from '@eec/core'
import type { Db } from '@eec/db'
import { and, asc, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { meditationDays, meditationPlans } from './schema.ts'

const AREA = 'meditations'
type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())

const reading = z
  .object({
    label: z.enum(READING_LABELS),
    ref: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .refine((r) => {
        // Every passage must exist: the book is known, the chapters and verses are inside it.
        const structured = parseStructured(r)
        return !!structured && checkPassage(structured) === null
      }),
  })
  .strict()
const psalm = z
  .string()
  .trim()
  .max(40)
  .refine((p) => {
    if (p === '') return true
    const ps = parsePsalm(p)
    return !!ps && checkPsalm(ps) === null
  })

export const dayBody = z
  .object({
    headlineFr: z.string().trim().max(120),
    headlineEn: z.string().trim().max(120),
    readings: z.array(reading).max(3),
    psalm,
    reflectionFr: z.string().trim().max(600),
    reflectionEn: z.string().trim().max(600),
    verseRef: z.string().trim().max(80),
    verseFr: z.string().trim().max(600),
    verseEn: z.string().trim().max(600),
  })
  .partial()
  .strict()

export const importBody = z
  .object({
    rows: z
      .array(
        z
          .object({
            date: day,
            headline: z.string().trim().max(120).default(''),
            readings: z.array(reading).max(3),
            psalm,
          })
          .strict()
          .refine((r) => r.readings.length > 0 || r.psalm !== ''),
      )
      .min(1)
      .max(400),
  })
  .strict()

export const planBody = z
  .object({
    titleFr: z.string().trim().min(1).max(160),
    titleEn: z.string().trim().max(160),
    descriptionFr: z.string().trim().max(600),
    descriptionEn: z.string().trim().max(600),
    startsOn: day,
    endsOn: day,
  })
  .partial()
  .strict()
  .refine((p) => !(p.startsOn && p.endsOn) || p.startsOn <= p.endsOn)

type DayRow = typeof meditationDays.$inferSelect
type PlanRow = typeof meditationPlans.$inferSelect

function dayDto(d: DayRow, locale: Locale) {
  const en = locale === 'en'
  const verseText = en ? d.verseEn : d.verseFr
  return {
    date: d.date,
    headline: (en && d.headlineEn) || d.headlineFr,
    readings: d.readings.map((r) => ({
      label: r.label || defaultLabel(parsePassage(r.ref).book),
      ref: formatPassage(r.ref, locale),
    })),
    psalm: d.psalm ? formatPsalm(d.psalm, locale) : '',
    reflection: (en && d.reflectionEn) || d.reflectionFr,
    // A verse is shown only when its text exists in the reader's translation (we never quote what we may not).
    verse:
      d.verseRef && verseText
        ? {
            ref: formatPassage(d.verseRef, locale),
            text: verseText,
            translation: en ? 'WEB' : 'LSG',
          }
        : null,
  }
}
const planDto = (p: PlanRow, locale: Locale) => ({
  slug: p.slug,
  title: (locale === 'en' && p.titleEn) || p.titleFr,
  description: (locale === 'en' && p.descriptionEn) || p.descriptionFr,
  startsOn: p.startsOn,
  endsOn: p.endsOn,
})

/** The published plan that covers a date (the most recently started when several do). */
async function planFor(db: Db, date: string) {
  const [p] = await db
    .select()
    .from(meditationPlans)
    .where(
      and(
        eq(meditationPlans.state, 'published'),
        lte(meditationPlans.startsOn, date),
        gte(meditationPlans.endsOn, date),
      ),
    )
    .orderBy(desc(meditationPlans.startsOn))
    .limit(1)
  return p ?? null
}

async function freeSlug(db: Db, base: string) {
  const rows = await db
    .select({ slug: meditationPlans.slug })
    .from(meditationPlans)
    .where(ilike(meditationPlans.slug, `${base}%`))
  const taken = new Set(rows.map((r) => r.slug))
  return uniqueSlug(base, (s) => taken.has(s))
}

export const meditationsApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public/day', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const asked = c.req.query('date')
    const date = asked && day.safeParse(asked).success ? asked : todayLocal()
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `meditations/day/${locale}/${date}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const plan = await planFor(db, date)
        if (!plan) return { plan: null, day: null, date }
        const [d] = await db
          .select()
          .from(meditationDays)
          .where(and(eq(meditationDays.planId, plan.id), eq(meditationDays.date, date)))
        return { plan: planDto(plan, locale), day: d ? dayDto(d, locale) : null, date }
      },
    })
  })
  .get('/public/month', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const asked = c.req.query('month')
    const month = asked && /^\d{4}-\d{2}$/.test(asked) ? asked : todayLocal().slice(0, 7)
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `meditations/month/${locale}/${month}/v${version}`,
      ttl: 300,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const plan = await planFor(db, `${month}-15`)
        if (!plan) return { plan: null, months: [] as string[], month, days: [] }
        const rows = await db
          .select()
          .from(meditationDays)
          .where(
            and(
              eq(meditationDays.planId, plan.id),
              sql`${meditationDays.date} like ${`${month}-%`}`,
            ),
          )
          .orderBy(asc(meditationDays.date))
        const all = await db
          .selectDistinct({ m: sql<string>`left(${meditationDays.date}, 7)` })
          .from(meditationDays)
          .where(eq(meditationDays.planId, plan.id))
          .orderBy(sql`left(${meditationDays.date}, 7)`)
        return {
          plan: planDto(plan, locale),
          months: all.map((x) => x.m),
          month,
          days: rows.map((d) => dayDto(d, locale)),
        }
      },
    })
  })
  // Every day of the plan covering today, compact: for « Ajouter à mon calendrier » (the file is built in the browser).
  .get('/public/plan', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    const date = todayLocal()
    return cachedJson(c, {
      key: `meditations/plan/${locale}/${date}/v${version}`,
      ttl: 600,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const plan = await planFor(db, date)
        if (!plan) return { plan: null, days: [] }
        const rows = await db
          .select()
          .from(meditationDays)
          .where(eq(meditationDays.planId, plan.id))
          .orderBy(asc(meditationDays.date))
        return {
          plan: planDto(plan, locale),
          days: rows.map((d) => {
            const x = dayDto(d, locale)
            return {
              date: x.date,
              headline: x.headline,
              passages: [...x.readings.map((r) => r.ref), ...(x.psalm ? [x.psalm] : [])],
            }
          }),
        }
      },
    })
  })

  // ——— Staff: plans ——————————————————————————————————————————
  .get('/plans', requirePermission('meditations:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select({
        p: meditationPlans,
        n: sql<number>`(select count(*)::int from meditation_days d where d.plan_id = meditation_plans.id)`,
        first: sql<
          string | null
        >`(select min(d.date) from meditation_days d where d.plan_id = meditation_plans.id)`,
        last: sql<
          string | null
        >`(select max(d.date) from meditation_days d where d.plan_id = meditation_plans.id)`,
      })
      .from(meditationPlans)
      .orderBy(desc(meditationPlans.startsOn))
    return c.json({
      items: rows.map((r) => ({ ...r.p, days: r.n, firstDay: r.first, lastDay: r.last })),
    })
  })
  .post('/plans', requirePermission('meditations:edit'), async (c) => {
    const body = planBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success || !body.data.titleFr || !body.data.startsOn || !body.data.endsOn)
      return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [row] = await db
      .insert(meditationPlans)
      .values({
        titleFr: body.data.titleFr,
        titleEn: body.data.titleEn ?? '',
        descriptionFr: body.data.descriptionFr ?? '',
        descriptionEn: body.data.descriptionEn ?? '',
        startsOn: body.data.startsOn,
        endsOn: body.data.endsOn,
        slug: await freeSlug(db, slugify(body.data.titleFr).slice(0, 60) || 'programme'),
        createdBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: 'meditation_plan',
      entityId: row.id,
      summaryFr: 'Programme de méditation créé',
      summaryEn: 'Meditation programme created',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/plans/:id', requirePermission('meditations:edit'), async (c) => {
    const body = planBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db
      .update(meditationPlans)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(meditationPlans.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'meditation_plan',
      entityId: row.id,
      summaryFr: 'Programme de méditation modifié',
      summaryEn: 'Meditation programme edited',
    })
    return c.json({ ok: true })
  })
  .post(
    '/plans/:id/:state{publish|unpublish}',
    requirePermission('meditations:publish'),
    async (c) => {
      const to = c.req.param('state') === 'publish' ? 'published' : 'draft'
      const db = await c.var.deps.db()
      const [row] = await db
        .update(meditationPlans)
        .set({ state: to, updatedAt: new Date() })
        .where(eq(meditationPlans.id, c.req.param('id')))
        .returning()
      if (!row) return fail(c, 404, 'not_found')
      await bumpContentVersion(db, AREA)
      await audit(c, {
        action: 'update',
        entityType: 'meditation_plan',
        entityId: row.id,
        summaryFr:
          to === 'published'
            ? 'Programme de méditation publié'
            : 'Programme de méditation retiré du site',
        summaryEn:
          to === 'published'
            ? 'Meditation programme published'
            : 'Meditation programme taken off the site',
      })
      return c.json({ ok: true })
    },
  )
  .delete('/plans/:id', requirePermission('meditations:delete'), async (c) => {
    const db = await c.var.deps.db()
    const res = await db
      .delete(meditationPlans)
      .where(eq(meditationPlans.id, c.req.param('id')))
      .returning({ id: meditationPlans.id })
    if (!res.length) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'meditation_plan',
      entityId: c.req.param('id'),
      summaryFr: 'Programme de méditation supprimé',
      summaryEn: 'Meditation programme deleted',
    })
    return c.json({ ok: true })
  })

  // ——— Staff: days ———————————————————————————————————————————
  .get('/plans/:id/days', requirePermission('meditations:read'), async (c) => {
    const db = await c.var.deps.db()
    const month = c.req.query('month')
    const where = [eq(meditationDays.planId, c.req.param('id'))]
    if (month && /^\d{4}-\d{2}$/.test(month))
      where.push(sql`${meditationDays.date} like ${`${month}-%`}`)
    const rows = await db
      .select()
      .from(meditationDays)
      .where(and(...where))
      .orderBy(asc(meditationDays.date))
      .limit(400)
    const months = await db
      .selectDistinct({ m: sql<string>`left(${meditationDays.date}, 7)` })
      .from(meditationDays)
      .where(eq(meditationDays.planId, c.req.param('id')))
      .orderBy(sql`left(${meditationDays.date}, 7)`)
    return c.json({ items: rows, months: months.map((m) => m.m) })
  })
  .put('/plans/:id/days/:date', requirePermission('meditations:edit'), async (c) => {
    const date = c.req.param('date')
    const body = dayBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success || !day.safeParse(date).success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const planId = c.req.param('id')
    const [plan] = await db
      .select({ id: meditationPlans.id })
      .from(meditationPlans)
      .where(eq(meditationPlans.id, planId))
    if (!plan) return fail(c, 404, 'not_found')
    const set = { ...body.data, updatedBy: actor?.userId, updatedAt: new Date() }
    await db
      .insert(meditationDays)
      .values({ planId, date, ...set })
      .onConflictDoUpdate({ target: [meditationDays.planId, meditationDays.date], set })
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'meditation_day',
      entityId: `${planId}:${date}`,
      summaryFr: 'Jour du programme de méditation modifié',
      summaryEn: 'Meditation day edited',
    })
    return c.json({ ok: true })
  })
  .delete('/plans/:id/days/:date', requirePermission('meditations:edit'), async (c) => {
    const db = await c.var.deps.db()
    const res = await db
      .delete(meditationDays)
      .where(
        and(
          eq(meditationDays.planId, c.req.param('id')),
          eq(meditationDays.date, c.req.param('date')),
        ),
      )
      .returning({ id: meditationDays.id })
    if (!res.length) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })
  // Bulk import (the CSV is read and checked in the browser; the server checks every row again). Existing days are updated.
  .post('/plans/:id/import', requirePermission('meditations:edit'), async (c) => {
    const body = importBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const planId = c.req.param('id')
    const [plan] = await db.select().from(meditationPlans).where(eq(meditationPlans.id, planId))
    if (!plan) return fail(c, 404, 'not_found')
    const dates = body.data.rows.map((r) => r.date)
    const existing = new Set(
      (
        await db
          .select({ d: meditationDays.date })
          .from(meditationDays)
          .where(and(eq(meditationDays.planId, planId), sql`${meditationDays.date} in ${dates}`))
      ).map((r) => r.d),
    )
    for (const r of body.data.rows) {
      const set = {
        headlineFr: r.headline,
        readings: r.readings,
        psalm: r.psalm,
        updatedBy: actor?.userId,
        updatedAt: new Date(),
      }
      await db
        .insert(meditationDays)
        .values({ planId, date: r.date, ...set })
        .onConflictDoUpdate({ target: [meditationDays.planId, meditationDays.date], set })
    }
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'create',
      entityType: 'meditation_import',
      entityId: planId,
      summaryFr: `Calendrier importé (${body.data.rows.length} jours)`,
      summaryEn: `Calendar imported (${body.data.rows.length} days)`,
    })
    return c.json({ created: body.data.rows.length - existing.size, updated: existing.size })
  })
