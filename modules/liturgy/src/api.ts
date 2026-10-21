/**
 * Liturgy API, mounted at /api/liturgy.
 * - Staff prepare Sundays (name suggested from the season, theme, readings, preacher, hymns), season texts and
 *   verses. Names of people are public only if consent was recorded (who confirmed, when).
 * - Public (edge-cached): the coming Sunday, the list of Sundays, approved season texts, the verse of the day.
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
import { can, type Principal } from '@eec/auth'
import {
  type BibleRef,
  cleanRef,
  comingSunday,
  formatRef,
  getSeason,
  SEASONS,
  suggestSundayName,
  sundaysFrom,
} from '@eec/core'
import type { Db } from '@eec/db'
import { roles, user, userRoles } from '@eec/db/schema'
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { liturgySeasons, liturgySundays, liturgyVerses } from './schema.ts'

const AREA = 'liturgy'
type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const ref = z.unknown().transform((v, ctx) => {
  const r = cleanRef(v)
  if (!r) ctx.addIssue({ code: 'custom', message: 'bad_ref' })
  return r as BibleRef
})

export const sundayBody = z
  .object({
    nameFr: z.string().max(160),
    nameEn: z.string().max(160),
    themeFr: z.string().max(200),
    themeEn: z.string().max(200),
    readings: z.array(ref).max(6),
    preacherName: z.string().max(120),
    liturgistName: z.string().max(120),
    namesConsent: z.boolean(),
    hymns: z.string().max(300),
    notesFr: z.string().max(500),
    notesEn: z.string().max(500),
  })
  .partial()
  .strict()
const seasonBody = z
  .object({
    meaningFr: z.string().max(1200),
    meaningEn: z.string().max(1200),
    parishFr: z.string().max(1200),
    parishEn: z.string().max(1200),
  })
  .partial()
  .strict()
export const verseBody = z
  .object({
    ref,
    textFr: z.string().max(800),
    textEn: z.string().max(800),
    translationFr: z.string().max(12),
    translationEn: z.string().max(12),
    onDate: date.nullable(),
    season: z.enum(SEASONS).nullable(),
    active: z.boolean(),
  })
  .partial()
  .strict()

type SundayRow = typeof liturgySundays.$inferSelect
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())

function publicSunday(row: SundayRow | undefined, d: string, locale: Locale) {
  const s = suggestSundayName(d)
  const en = locale === 'en'
  return {
    date: d,
    season: s.season,
    name: (en ? row?.nameEn || row?.nameFr : row?.nameFr) || (en ? s.en : s.fr),
    theme: (en ? row?.themeEn || row?.themeFr : row?.themeFr) ?? '',
    readings: (row?.readings ?? []).map((r) => ({ ...r, label: formatRef(r, locale) })),
    // People's names only with recorded consent.
    preacher: row?.namesConsent ? row.preacherName : '',
    liturgist: row?.namesConsent ? row.liturgistName : '',
    hymns: row?.hymns ?? '',
    notes: (en ? row?.notesEn || row?.notesFr : row?.notesFr) ?? '',
    published: !!row,
  }
}

async function publishedSundays(db: Db, from: string, to: string) {
  return db
    .select()
    .from(liturgySundays)
    .where(
      and(
        eq(liturgySundays.state, 'published'),
        gte(liturgySundays.date, from),
        lte(liturgySundays.date, to),
      ),
    )
    .orderBy(asc(liturgySundays.date))
}

export async function verseOfTheDay(db: Db, d: string, locale: Locale) {
  const season = getSeason(new Date(`${d}T12:00:00Z`))
  const dated = await db
    .select()
    .from(liturgyVerses)
    .where(and(eq(liturgyVerses.active, true), eq(liturgyVerses.onDate, d)))
    .limit(1)
  let pick = dated[0]
  if (!pick) {
    const seasonal = await db
      .select()
      .from(liturgyVerses)
      .where(
        and(
          eq(liturgyVerses.active, true),
          eq(liturgyVerses.season, season),
          isNull(liturgyVerses.onDate),
        ),
      )
      .orderBy(asc(liturgyVerses.id))
    if (seasonal.length)
      pick = seasonal[Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000) % seasonal.length]
  }
  if (!pick) {
    const pool = await db
      .select()
      .from(liturgyVerses)
      .where(
        and(
          eq(liturgyVerses.active, true),
          isNull(liturgyVerses.onDate),
          isNull(liturgyVerses.season),
        ),
      )
      .orderBy(asc(liturgyVerses.id))
    if (pool.length)
      pick = pool[Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000) % pool.length]
  }
  // A verse with no text in the reader's translation is not shown (we never quote what we may not).
  const text = pick ? (locale === 'en' ? pick.textEn : pick.textFr) : ''
  if (!pick || !text.trim()) return null
  return {
    ref: formatRef(pick.ref, locale),
    text,
    translation: locale === 'en' ? pick.translationEn : pick.translationFr,
  }
}

export const liturgyApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public/sunday', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    const d = comingSunday(new Date())
    return cachedJson(c, {
      key: `liturgy/sunday/${locale}/${d}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const [row] = await db
          .select()
          .from(liturgySundays)
          .where(and(eq(liturgySundays.date, d), eq(liturgySundays.state, 'published')))
          .limit(1)
        return publicSunday(row, d, locale)
      },
    })
  })
  .get('/public/sundays', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    const d = comingSunday(new Date())
    return cachedJson(c, {
      key: `liturgy/sundays/${locale}/${d}/v${version}`,
      ttl: 300,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const back = new Date(Date.parse(`${d}T00:00:00Z`) - 5 * 7 * 86_400_000)
          .toISOString()
          .slice(0, 10)
        const forward = new Date(Date.parse(`${d}T00:00:00Z`) + 10 * 7 * 86_400_000)
          .toISOString()
          .slice(0, 10)
        const rows = await publishedSundays(db, back, forward)
        return { current: d, items: rows.map((r) => publicSunday(r, r.date, locale)) }
      },
    })
  })
  .get('/public/seasons', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `liturgy/seasons/${locale}/v${version}`,
      ttl: 600,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const rows = await db
          .select()
          .from(liturgySeasons)
          .where(eq(liturgySeasons.validated, true))
        return {
          items: rows.map((r) => ({
            season: r.season,
            meaning: (locale === 'en' ? r.meaningEn || r.meaningFr : r.meaningFr) ?? '',
            parish: (locale === 'en' ? r.parishEn || r.parishFr : r.parishFr) ?? '',
          })),
        }
      },
    })
  })
  .get('/public/verse', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    const d = today()
    return cachedJson(c, {
      key: `liturgy/verse/${locale}/${d}/v${version}`,
      ttl: 600,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => ({ verse: await verseOfTheDay(db, d, locale) }),
    })
  })

  // ——— Staff ————————————————————————————————————————————————
  // The next 8 Sundays (empty ones included) and the 4 before.
  .get('/sundays', requirePermission('liturgy:read'), async (c) => {
    const db = await c.var.deps.db()
    const first = comingSunday(new Date())
    const dates = [
      ...sundaysFrom(
        new Date(Date.parse(`${first}T00:00:00Z`) - 4 * 7 * 86_400_000).toISOString().slice(0, 10),
        4,
      ),
      ...sundaysFrom(first, 8),
    ]
    const rows = await db
      .select()
      .from(liturgySundays)
      .where(
        and(
          gte(liturgySundays.date, dates[0] as string),
          lte(liturgySundays.date, dates.at(-1) as string),
        ),
      )
    return c.json({
      current: first,
      items: dates.map((d) => ({
        date: d,
        suggested: suggestSundayName(d),
        entry: rows.find((r) => r.date === d) ?? null,
      })),
    })
  })
  // Names to suggest for the preacher: people given the « Pasteur » role. Free text stays possible (a guest, another member).
  .get('/people', requirePermission('liturgy:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select({ name: user.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(user, eq(user.id, userRoles.userId))
      .where(eq(roles.key, 'pasteur'))
      .orderBy(asc(user.name))
      .limit(100)
    return c.json({ names: [...new Set(rows.map((r) => r.name).filter(Boolean))] })
  })
  .put('/sundays/:date', requirePermission('liturgy:edit'), async (c) => {
    const d = c.req.param('date')
    if (!date.safeParse(d).success || new Date(`${d}T00:00:00Z`).getUTCDay() !== 0)
      return fail(c, 400, 'invalid')
    const parsed = sundayBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const p = parsed.data
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const set: Partial<typeof liturgySundays.$inferInsert> = { ...p, updatedBy: actor?.userId }
    // Consent: who confirmed it and when are recorded with the box; unticking clears them.
    if (p.namesConsent === true)
      Object.assign(set, { namesConfirmedBy: actor?.userId, namesConfirmedAt: new Date() })
    if (p.namesConsent === false)
      Object.assign(set, { namesConfirmedBy: null, namesConfirmedAt: null })
    const [row] = await db
      .insert(liturgySundays)
      .values({ date: d, ...set })
      .onConflictDoUpdate({ target: liturgySundays.date, set })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    if (row.state === 'published') await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'liturgy_sunday',
      entityId: row.id,
      summaryFr: `Dimanche ${d} modifié`,
      summaryEn: `Sunday ${d} edited`,
      diff: { fields: Object.keys(p) },
    })
    return c.json({ ok: true })
  })
  .post('/sundays/:date/duplicate-previous', requirePermission('liturgy:edit'), async (c) => {
    const d = c.req.param('date')
    if (!date.safeParse(d).success) return fail(c, 400, 'invalid')
    const prev = new Date(Date.parse(`${d}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
    const db = await c.var.deps.db()
    const [src] = await db
      .select()
      .from(liturgySundays)
      .where(eq(liturgySundays.date, prev))
      .limit(1)
    if (!src) return fail(c, 404, 'not_found')
    const actor = await c.var.deps.actor()
    // Copies the shape of the day, never the people (their consent was for one Sunday).
    const values = {
      nameFr: '',
      nameEn: '',
      themeFr: src.themeFr,
      themeEn: src.themeEn,
      readings: [],
      hymns: src.hymns,
      notesFr: src.notesFr,
      notesEn: src.notesEn,
      state: 'draft' as const,
      updatedBy: actor?.userId,
    }
    await db
      .insert(liturgySundays)
      .values({ date: d, ...values })
      .onConflictDoUpdate({ target: liturgySundays.date, set: values })
    await audit(c, {
      action: 'update',
      entityType: 'liturgy_sunday',
      entityId: d,
      summaryFr: `Dimanche ${d} : semaine précédente dupliquée`,
      summaryEn: `Sunday ${d}: previous week duplicated`,
    })
    return c.json({ ok: true })
  })
  .post('/sundays/:date/publish', requirePermission('liturgy:publish'), async (c) => {
    const body = z
      .object({ published: z.boolean() })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db
      .update(liturgySundays)
      .set(
        body.data.published ? { state: 'published', publishedAt: new Date() } : { state: 'draft' },
      )
      .where(eq(liturgySundays.date, c.req.param('date')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'publish',
      entityType: 'liturgy_sunday',
      entityId: row.id,
      summaryFr: `Dimanche ${row.date} ${body.data.published ? 'publié' : 'retiré du site'}`,
      summaryEn: `Sunday ${row.date} ${body.data.published ? 'published' : 'taken off the site'}`,
    })
    return c.json({ ok: true })
  })
  .get('/seasons', requirePermission('liturgy:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db.select().from(liturgySeasons)
    return c.json({
      items: SEASONS.map((s) => ({ season: s, row: rows.find((r) => r.season === s) ?? null })),
    })
  })
  .put('/seasons/:season', requirePermission('liturgy:edit'), async (c) => {
    const season = c.req.param('season')
    if (!(SEASONS as readonly string[]).includes(season)) return fail(c, 400, 'invalid')
    const parsed = seasonBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const mayValidate = can(actor?.principal as Principal, 'liturgy:validate')
    // An edit takes the approval away unless the editor may approve.
    const set = {
      ...parsed.data,
      ...(mayValidate ? {} : { validated: false, validatedBy: null, validatedAt: null }),
    }
    const [row] = await db
      .insert(liturgySeasons)
      .values({ season, ...set })
      .onConflictDoUpdate({ target: liturgySeasons.season, set })
      .returning()
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'liturgy_season',
      entityId: row?.id,
      summaryFr: `Texte de la saison « ${season} » modifié`,
      summaryEn: `Season “${season}” text edited`,
    })
    return c.json({ ok: true })
  })
  .post('/seasons/:season/validate', requirePermission('liturgy:validate'), async (c) => {
    const body = z
      .object({ validated: z.boolean() })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [row] = await db
      .update(liturgySeasons)
      .set(
        body.data.validated
          ? { validated: true, validatedBy: actor?.userId, validatedAt: new Date() }
          : { validated: false, validatedBy: null, validatedAt: null },
      )
      .where(eq(liturgySeasons.season, c.req.param('season')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'liturgy_season',
      entityId: row.id,
      summaryFr: `Texte de saison ${body.data.validated ? 'approuvé' : 'retiré du site'}`,
      summaryEn: `Season text ${body.data.validated ? 'approved' : 'taken off the site'}`,
    })
    return c.json({ ok: true })
  })
  .get('/verses', requirePermission('liturgy:read'), async (c) => {
    const db = await c.var.deps.db()
    return c.json({
      items: await db
        .select()
        .from(liturgyVerses)
        .orderBy(desc(liturgyVerses.createdAt))
        .limit(300),
    })
  })
  .post('/verses', requirePermission('liturgy:edit'), async (c) => {
    const parsed = verseBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !parsed.data.ref) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db
      .insert(liturgyVerses)
      .values({ ...parsed.data, ref: parsed.data.ref })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'create',
      entityType: 'liturgy_verse',
      entityId: row.id,
      summaryFr: 'Verset ajouté',
      summaryEn: 'Verse added',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/verses/:id', requirePermission('liturgy:edit'), async (c) => {
    const parsed = verseBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db
      .update(liturgyVerses)
      .set(parsed.data)
      .where(eq(liturgyVerses.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'liturgy_verse',
      entityId: row.id,
      summaryFr: 'Verset modifié',
      summaryEn: 'Verse edited',
    })
    return c.json({ ok: true })
  })
  .delete('/verses/:id', requirePermission('liturgy:edit'), async (c) => {
    const db = await c.var.deps.db()
    const [row] = await db
      .delete(liturgyVerses)
      .where(eq(liturgyVerses.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'liturgy_verse',
      entityId: row.id,
      summaryFr: 'Verset supprimé',
      summaryEn: 'Verse deleted',
    })
    return c.json({ ok: true })
  })
