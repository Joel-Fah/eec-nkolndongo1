/**
 * Sermons API, mounted at /api/sermons.
 * - Staff: list, read, write (autosave), publish / schedule / unpublish / archive, revisions, preview links, series.
 * - Public (edge-cached): the list with filters (series, preacher, Bible book, year), one sermon, and the filter choices.
 * A sermon holds text, passages and LINKS (a YouTube video, any https link such as audio on Drive): the site hosts no audio
 * and loads nothing from those links (decision 0034). The preacher's name is public only with a recorded consent (0031).
 */
import {
  type AppEnv,
  audit,
  bumpContentVersion,
  cachedJson,
  contentRoutes,
  fail,
  mayOn,
  requirePermission,
  requirePermissionAnywhere,
  verifyPreview,
  versionFor,
} from '@eec/api-kit'
import {
  type BibleRef,
  BOOKS,
  cleanDoc,
  cleanRef,
  formatRef,
  isEmptyDoc,
  plainText,
  publishProblems,
  renderHtml,
  slugify,
  statusOf,
  uniqueSlug,
} from '@eec/core'
import type { Db } from '@eec/db'
import { contentRedirects, mediaFiles } from '@eec/db/schema'
import { and, asc, desc, eq, ilike, isNull, lte, or, type SQL, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { type SermonLink, sermonSeries, sermons } from './schema.ts'

const AREA = 'sermons'
const ENTITY = 'sermon'
const PAGE = 12

type Row = typeof sermons.$inferSelect
type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')

// ——— Links ——————————————————————————————————————————————————————
/** The 11-character id of a YouTube video from a pasted address (watch, youtu.be, embed, shorts) or the bare id. */
export function youtubeIdOf(input: string): string {
  const v = input.trim()
  if (!v) return ''
  if (/^[\w-]{11}$/.test(v)) return v
  try {
    const u = new URL(v)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    let id = ''
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? ''
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v') ?? ''
      else id = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] ?? ''
    }
    return /^[\w-]{11}$/.test(id) ? id : ''
  } catch {
    return ''
  }
}

/** An https address, nothing else (no javascript:, no data:, no plain http). Returns the clean address or null. */
export function cleanUrl(input: string): string | null {
  try {
    const u = new URL(input.trim())
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password)
      return null
    const s = u.toString()
    return s.length <= 500 ? s : null
  } catch {
    return null
  }
}

const link = z
  .object({ label: z.string().trim().max(80), url: z.string().trim().max(500) })
  .strict()
  .transform((l, ctx) => {
    const url = cleanUrl(l.url)
    if (!url) ctx.addIssue({ code: 'custom', message: 'bad_url' })
    return { label: l.label, url: url ?? '' } satisfies SermonLink
  })

const date = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s))
  .nullable()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const doc = z
  .unknown()
  .refine((v) => JSON.stringify(v ?? null).length < 400_000, 'too_large')
  .transform((v) => cleanDoc(v))
const ref = z.unknown().transform((v, ctx) => {
  const r = cleanRef(v)
  if (!r) ctx.addIssue({ code: 'custom', message: 'bad_ref' })
  return r as BibleRef
})

export const patchSchema = z
  .object({
    titleFr: z.string().max(200),
    titleEn: z.string().max(200),
    summaryFr: z.string().max(500),
    summaryEn: z.string().max(500),
    bodyFr: doc,
    bodyEn: doc,
    transcript: doc,
    preachedOn: day.nullable(),
    seriesId: z.string().uuid().nullable(),
    preacherName: z.string().max(120),
    preacherConsent: z.boolean(),
    refs: z.array(ref).max(8),
    youtube: z.string().max(300),
    links: z.array(link).max(4),
    coverMediaId: z.string().uuid().nullable(),
    groupId: z.string().uuid().nullable(),
    sundayDate: day.nullable(),
    slug: z.string().max(120),
  })
  .partial()
  .strict()

export const seriesSchema = z
  .object({
    titleFr: z.string().trim().max(160),
    titleEn: z.string().trim().max(160),
    descriptionFr: z.string().trim().max(600),
    descriptionEn: z.string().trim().max(600),
  })
  .partial()
  .strict()

const slugOf = (title: string) => slugify(title).slice(0, 80)

async function freeSlug(db: Db, base: string, except?: string) {
  const rows = await db
    .select({ slug: sermons.slug, id: sermons.id })
    .from(sermons)
    .where(ilike(sermons.slug, `${base}%`))
  const taken = new Set(rows.filter((r) => r.id !== except).map((r) => r.slug))
  return uniqueSlug(base, (s) => taken.has(s))
}
async function freeSeriesSlug(db: Db, base: string, except?: string) {
  const rows = await db
    .select({ slug: sermonSeries.slug, id: sermonSeries.id })
    .from(sermonSeries)
    .where(ilike(sermonSeries.slug, `${base}%`))
  const taken = new Set(rows.filter((r) => r.id !== except).map((r) => r.slug))
  return uniqueSlug(base, (s) => taken.has(s))
}

const snapshotOf = (r: Row) => ({
  titleFr: r.titleFr,
  titleEn: r.titleEn,
  summaryFr: r.summaryFr,
  summaryEn: r.summaryEn,
  bodyFr: r.bodyFr,
  bodyEn: r.bodyEn,
  transcript: r.transcript,
  preachedOn: r.preachedOn,
  seriesId: r.seriesId,
  preacherName: r.preacherName,
  refs: r.refs,
  youtubeId: r.youtubeId,
  links: r.links,
  coverMediaId: r.coverMediaId,
  groupId: r.groupId,
  sundayDate: r.sundayDate,
  slug: r.slug,
})

const lifecycleOf = (r: Row) => ({
  state: r.state as 'draft' | 'published' | 'archived',
  publishAt: r.publishAt,
  unpublishAt: r.unpublishAt,
})

const adminDto = (r: Row, seriesTitle?: string | null) => ({
  id: r.id,
  slug: r.slug,
  status: statusOf(lifecycleOf(r)),
  state: r.state,
  groupId: r.groupId,
  seriesId: r.seriesId,
  seriesTitle: seriesTitle ?? null,
  publishAt: r.publishAt,
  unpublishAt: r.unpublishAt,
  firstPublishedAt: r.firstPublishedAt,
  titleFr: r.titleFr,
  titleEn: r.titleEn,
  preachedOn: r.preachedOn,
  preacherName: r.preacherName,
  updatedAt: r.updatedAt,
})

const liveNow = () =>
  and(
    eq(sermons.state, 'published'),
    or(isNull(sermons.publishAt), lte(sermons.publishAt, sql`now()`)),
    or(isNull(sermons.unpublishAt), sql`${sermons.unpublishAt} > now()`),
  ) as SQL

const mediaOut = (m: typeof mediaFiles.$inferSelect | undefined) =>
  m
    ? {
        variants: m.variants,
        placeholder: m.placeholder,
        altFr: m.altFr,
        altEn: m.altEn,
        width: m.width,
        height: m.height,
        credit: m.credit,
      }
    : null

type PublicFilters = {
  series?: string | null
  preacher?: string | null
  book?: string | null
  year?: string | null
}

async function publicItems(
  db: Db,
  locale: Locale,
  offset: number,
  limit: number,
  f: PublicFilters = {},
) {
  const conds: (SQL | undefined)[] = [liveNow()]
  if (f.series)
    conds.push(sql`${sermons.seriesId} = (select id from sermon_series where slug = ${f.series})`)
  // Only a consented name can be a filter: a hidden name must not be discoverable.
  if (f.preacher)
    conds.push(and(eq(sermons.preacherConsent, true), eq(sermons.preacherName, f.preacher)))
  if (f.book) conds.push(sql`${sermons.refs} @> ${JSON.stringify([{ book: f.book }])}::jsonb`)
  if (f.year) conds.push(sql`${sermons.preachedOn} like ${`${f.year}-%`}`)
  const rows = await db
    .select({ s: sermons, series: sermonSeries })
    .from(sermons)
    .leftJoin(sermonSeries, eq(sermonSeries.id, sermons.seriesId))
    .where(and(...conds))
    .orderBy(
      sql`${sermons.preachedOn} desc nulls last`,
      desc(sql`coalesce(${sermons.publishAt}, ${sermons.firstPublishedAt}, ${sermons.createdAt})`),
    )
    .offset(offset)
    .limit(limit + 1)
  const page = rows.slice(0, limit)
  const mediaIds = page.map((r) => r.s.coverMediaId).filter((x): x is string => !!x)
  const media = mediaIds.length
    ? await db.select().from(mediaFiles).where(sql`${mediaFiles.id} in ${mediaIds}`)
    : []
  return {
    more: rows.length > limit,
    items: page.map(({ s, series }) =>
      dto(
        s,
        series ?? null,
        locale,
        media.find((m) => m.id === s.coverMediaId),
      ),
    ),
  }
}

function dto(
  s: Row,
  series: typeof sermonSeries.$inferSelect | null,
  locale: Locale,
  cover?: typeof mediaFiles.$inferSelect,
) {
  const en = locale === 'en' && s.titleEn.trim() !== ''
  return {
    id: s.id,
    slug: s.slug,
    title: en ? s.titleEn : s.titleFr,
    summary: (en ? s.summaryEn : s.summaryFr) || plainText(en ? s.bodyEn : s.bodyFr).slice(0, 200),
    fallback: locale === 'en' && !en,
    preachedOn: s.preachedOn,
    // A name only with a recorded consent; otherwise the field is empty.
    preacher: s.preacherConsent ? s.preacherName : '',
    series: series
      ? {
          slug: series.slug,
          title: locale === 'en' && series.titleEn ? series.titleEn : series.titleFr,
        }
      : null,
    refs: s.refs.map((r) => ({ book: r.book, label: formatRef(r, locale) })),
    hasVideo: !!s.youtubeId,
    hasLinks: s.links.length > 0,
    cover: mediaOut(cover),
  }
}

async function publicDetail(db: Db, row: Row, locale: Locale) {
  const [series] = row.seriesId
    ? await db.select().from(sermonSeries).where(eq(sermonSeries.id, row.seriesId))
    : []
  const [cover] = row.coverMediaId
    ? await db.select().from(mediaFiles).where(eq(mediaFiles.id, row.coverMediaId))
    : []
  const en = locale === 'en' && row.titleEn.trim() !== ''
  const body = en ? row.bodyEn : row.bodyFr
  return {
    ...dto(row, series ?? null, locale, cover),
    html: renderHtml(body),
    text: plainText(body).slice(0, 5000),
    transcriptHtml: isEmptyDoc(row.transcript) ? '' : renderHtml(row.transcript),
    youtubeId: row.youtubeId,
    // The host is shown so people know where a link leads; the site never loads anything from it.
    links: row.links.map((l) => ({
      label: l.label,
      url: l.url,
      host: new URL(l.url).hostname.replace(/^www\./, ''),
    })),
    sundayDate: row.sundayDate,
  }
}

async function publicFilters(db: Db, locale: Locale) {
  const live = liveNow()
  const [series, preachers, books, years] = await Promise.all([
    db
      .select({
        slug: sermonSeries.slug,
        titleFr: sermonSeries.titleFr,
        titleEn: sermonSeries.titleEn,
        descFr: sermonSeries.descriptionFr,
        descEn: sermonSeries.descriptionEn,
        n: sql<number>`count(${sermons.id})::int`,
      })
      .from(sermonSeries)
      .innerJoin(sermons, and(eq(sermons.seriesId, sermonSeries.id), live))
      .groupBy(sermonSeries.id)
      .orderBy(asc(sermonSeries.titleFr)),
    db
      .selectDistinct({ name: sermons.preacherName })
      .from(sermons)
      .where(and(live, eq(sermons.preacherConsent, true), sql`${sermons.preacherName} <> ''`))
      .orderBy(asc(sermons.preacherName)),
    db.select({ refs: sermons.refs }).from(sermons).where(live),
    db
      .selectDistinct({ y: sql<string>`left(${sermons.preachedOn}, 4)` })
      .from(sermons)
      .where(and(live, sql`${sermons.preachedOn} is not null`))
      .orderBy(desc(sql`left(${sermons.preachedOn}, 4)`)),
  ])
  const used = new Set(books.flatMap((b) => b.refs.map((r) => r.book)))
  return {
    series: series.map((s) => ({
      slug: s.slug,
      title: locale === 'en' && s.titleEn ? s.titleEn : s.titleFr,
      description: locale === 'en' && s.descEn ? s.descEn : s.descFr,
      count: s.n,
    })),
    preachers: preachers.map((p) => p.name),
    books: BOOKS.filter((b) => used.has(b.id)).map((b) => ({ id: b.id, label: b[locale] })),
    years: years.map((y) => y.y),
  }
}

const lifecycle = contentRoutes<Row>({
  entity: ENTITY,
  area: AREA,
  table: sermons,
  perms: {
    read: 'sermons:read',
    edit: 'sermons:edit',
    publish: 'sermons:publish',
    delete: 'sermons:delete',
  },
  labels: {
    published: { fr: 'Prédication publiée', en: 'Sermon published' },
    scheduled: { fr: 'Prédication programmée', en: 'Sermon scheduled' },
    unpublished: { fr: 'Prédication retirée du site', en: 'Sermon taken off the site' },
    archived: { fr: 'Prédication archivée', en: 'Sermon archived' },
    deleted: { fr: 'Prédication supprimée', en: 'Sermon deleted' },
    restored: { fr: 'Ancienne version restaurée', en: 'Earlier version restored' },
  },
  snapshotOf,
  restoreSet: (s: ReturnType<typeof snapshotOf>) => ({
    titleFr: s.titleFr,
    titleEn: s.titleEn,
    summaryFr: s.summaryFr,
    summaryEn: s.summaryEn,
    bodyFr: cleanDoc(s.bodyFr),
    bodyEn: cleanDoc(s.bodyEn),
    transcript: cleanDoc(s.transcript),
    preachedOn: s.preachedOn,
    refs: s.refs,
    youtubeId: s.youtubeId,
    links: s.links,
    coverMediaId: s.coverMediaId,
  }),
  // A sermon may be only a recording: a title is enough to publish.
  problems: (row, dates) => publishProblems({ title: row.titleFr, bodyEmpty: false, ...dates }),
  mediaIdsOf: (row) => {
    const out: { id: string; field: string }[] = []
    if (row.coverMediaId) out.push({ id: row.coverMediaId, field: 'cover' })
    for (const body of [row.bodyFr, row.bodyEn, row.transcript])
      for (const m of JSON.stringify(body).matchAll(/"mediaId":"([0-9a-f-]{36})"/g))
        if (m[1]) out.push({ id: m[1], field: 'body' })
    return out
  },
  revisionLabel: (s: ReturnType<typeof snapshotOf>) => ({
    title: s.titleFr,
    words: plainText(s.bodyFr).split(' ').filter(Boolean).length,
  }),
})
const { load, saveRevision, syncUsages } = lifecycle

const filterQuery = (c: { req: { query: (k: string) => string | undefined } }): PublicFilters => {
  const slug = (v?: string) => (v && /^[a-z0-9-]{1,80}$/.test(v) ? v : null)
  const b = c.req.query('book')
  const y = c.req.query('year')
  const p = c.req.query('preacher')
  return {
    series: slug(c.req.query('series')),
    book: b && /^[a-z0-9]{2,12}$/.test(b) ? b : null,
    year: y && /^\d{4}$/.test(y) ? y : null,
    preacher: p ? p.slice(0, 120) : null,
  }
}

export const sermonsApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const page = Math.max(1, Math.min(Number(c.req.query('page')) || 1, 200))
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || PAGE, 1), 24)
    const f = filterQuery(c)
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `sermons/list/${locale}/${page}/${limit}/${f.series ?? '-'}/${f.book ?? '-'}/${f.year ?? '-'}/${encodeURIComponent(f.preacher ?? '-')}/v${version}`,
      ttl: 60,
      keep: 60 * 60 * 24 * 7,
      load: (db) => publicItems(db, locale, (page - 1) * limit, limit, f),
    })
  })
  .get('/public/filters', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `sermons/filters/${locale}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: (db) => publicFilters(db, locale),
    })
  })
  .get('/public/item/:slug', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const slug = c.req.param('slug')
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `sermons/item/${locale}/${slug}/v${version}`,
      ttl: 60,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const [row] = await db
          .select()
          .from(sermons)
          .where(and(eq(sermons.slug, slug), liveNow()))
          .limit(1)
        if (row) return { found: true as const, sermon: await publicDetail(db, row, locale) }
        const [moved] = await db
          .select({ id: contentRedirects.entityId })
          .from(contentRedirects)
          .where(and(eq(contentRedirects.entityType, ENTITY), eq(contentRedirects.fromPath, slug)))
          .limit(1)
        const [target] = moved
          ? await db
              .select({ slug: sermons.slug })
              .from(sermons)
              .where(and(eq(sermons.id, moved.id), liveNow()))
          : []
        return { found: false as const, redirect: target?.slug ?? null }
      },
    })
  })
  .get('/public/preview/:token', async (c) => {
    const id = await verifyPreview(c.env.AUTH_SECRET, c.req.param('token'), ENTITY)
    if (!id) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db.select().from(sermons).where(eq(sermons.id, id)).limit(1)
    if (!row) return fail(c, 404, 'not_found')
    const s = await publicDetail(db, row, localeOf(c.req.query('locale')))
    return c.json(s, 200, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' })
  })

  // ——— Staff: series ——————————————————————————————————————————
  .get('/series', requirePermission('sermons:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select({
        s: sermonSeries,
        n: sql<number>`(select count(*)::int from sermons where series_id = ${sermonSeries.id})`,
      })
      .from(sermonSeries)
      .orderBy(asc(sermonSeries.titleFr))
    return c.json({ items: rows.map((r) => ({ ...r.s, count: r.n })) })
  })
  .post('/series', requirePermission('sermons:edit'), async (c) => {
    const parsed = seriesSchema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const title = parsed.data.titleFr ?? ''
    const [row] = await db
      .insert(sermonSeries)
      .values({
        ...parsed.data,
        slug: await freeSeriesSlug(db, slugOf(title) || 'serie'),
        createdBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: 'sermon_series',
      entityId: row.id,
      summaryFr: 'Série de prédications créée',
      summaryEn: 'Sermon series created',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ id: row.id }, 201)
  })
  .patch('/series/:id', requirePermission('sermons:edit'), async (c) => {
    const parsed = seriesSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db
      .update(sermonSeries)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(sermonSeries.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await audit(c, {
      action: 'update',
      entityType: 'sermon_series',
      entityId: row.id,
      summaryFr: 'Série de prédications modifiée',
      summaryEn: 'Sermon series edited',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })
  .delete('/series/:id', requirePermission('sermons:delete'), async (c) => {
    const db = await c.var.deps.db()
    const res = await db
      .delete(sermonSeries)
      .where(eq(sermonSeries.id, c.req.param('id')))
      .returning({ id: sermonSeries.id })
    if (!res.length) return fail(c, 404, 'not_found')
    await audit(c, {
      action: 'delete',
      entityType: 'sermon_series',
      entityId: c.req.param('id'),
      summaryFr: 'Série de prédications supprimée (les prédications restent)',
      summaryEn: 'Sermon series deleted (the sermons stay)',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })

  // ——— Staff: sermons ————————————————————————————————————————
  .get('/', requirePermissionAnywhere('sermons:read'), async (c) => {
    const db = await c.var.deps.db()
    const q = c.req.query()
    const where: (SQL | undefined)[] = []
    if (q.q) where.push(or(ilike(sermons.titleFr, `%${q.q}%`), ilike(sermons.titleEn, `%${q.q}%`)))
    if (q.series) where.push(eq(sermons.seriesId, q.series))
    const rows = await db
      .select({ s: sermons, seriesTitle: sermonSeries.titleFr })
      .from(sermons)
      .leftJoin(sermonSeries, eq(sermonSeries.id, sermons.seriesId))
      .where(and(...where))
      .orderBy(sql`${sermons.preachedOn} desc nulls last`, desc(sermons.updatedAt))
      .limit(300)
    let items = rows.map((r) => adminDto(r.s, r.seriesTitle))
    if (q.status && ['draft', 'scheduled', 'published', 'archived'].includes(q.status))
      items = items.filter((i) => i.status === q.status)
    const counts = { draft: 0, scheduled: 0, published: 0, archived: 0 }
    for (const r of rows) counts[statusOf(lifecycleOf(r.s))]++
    return c.json({ items, counts })
  })
  .get('/:id', requirePermissionAnywhere('sermons:read'), async (c) => {
    const r = await load(c, c.req.param('id'), 'sermons:read')
    if (r.error) return r.error
    return c.json({
      ...adminDto(r.row),
      summaryFr: r.row.summaryFr,
      summaryEn: r.row.summaryEn,
      bodyFr: r.row.bodyFr,
      bodyEn: r.row.bodyEn,
      transcript: r.row.transcript,
      preacherConsent: r.row.preacherConsent,
      refs: r.row.refs,
      youtubeId: r.row.youtubeId,
      links: r.row.links,
      coverMediaId: r.row.coverMediaId,
      sundayDate: r.row.sundayDate,
    })
  })
  .post('/', requirePermissionAnywhere('sermons:edit'), async (c) => {
    const body = z
      .object({
        titleFr: z.string().max(200).default(''),
        preachedOn: day.nullable().default(null),
        preacherName: z.string().max(120).default(''),
        refs: z.array(ref).max(8).default([]),
        sundayDate: day.nullable().default(null),
      })
      .safeParse(await c.req.json().catch(() => ({})))
    if (!body.success) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'sermons:edit', null))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const slug = await freeSlug(db, slugOf(body.data.titleFr) || 'sans-titre')
    const [row] = await db
      .insert(sermons)
      .values({ ...body.data, slug, createdBy: actor?.userId, updatedBy: actor?.userId })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: ENTITY,
      entityId: row.id,
      summaryFr: 'Prédication créée',
      summaryEn: 'Sermon created',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/:id', requirePermissionAnywhere('sermons:edit'), async (c) => {
    const r = await load(c, c.req.param('id'), 'sermons:edit')
    if (r.error) return r.error
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const { db, row } = r
    const patch = parsed.data
    if (patch.coverMediaId) {
      const [m] = await db
        .select({ kind: mediaFiles.kind })
        .from(mediaFiles)
        .where(eq(mediaFiles.id, patch.coverMediaId))
      if (m?.kind !== 'image') return fail(c, 400, 'invalid')
    }
    if (patch.youtube !== undefined && patch.youtube.trim() !== '' && !youtubeIdOf(patch.youtube))
      return fail(c, 400, 'bad_youtube')
    const actor = await c.var.deps.actor()
    const set: Partial<typeof sermons.$inferInsert> = {}
    for (const k of [
      'titleFr',
      'titleEn',
      'summaryFr',
      'summaryEn',
      'bodyFr',
      'bodyEn',
      'transcript',
      'preachedOn',
      'seriesId',
      'preacherName',
      'refs',
      'links',
      'coverMediaId',
      'groupId',
      'sundayDate',
    ] as const)
      if (patch[k] !== undefined) (set as Record<string, unknown>)[k] = patch[k]
    if (patch.youtube !== undefined) set.youtubeId = youtubeIdOf(patch.youtube)
    // The consent for the preacher's name records who confirmed it and when; unticking clears it (decision 0031).
    if (patch.preacherConsent !== undefined) {
      set.preacherConsent = patch.preacherConsent
      set.preacherConfirmedBy = patch.preacherConsent ? (actor?.userId ?? null) : null
      set.preacherConfirmedAt = patch.preacherConsent ? new Date() : null
    }
    let newSlug: string | undefined
    if (patch.slug !== undefined) {
      const wanted = slugOf(patch.slug)
      if (wanted && wanted !== row.slug) newSlug = await freeSlug(db, wanted, row.id)
    } else if (patch.titleFr !== undefined && !row.firstPublishedAt && patch.titleFr.trim()) {
      const wanted = slugOf(patch.titleFr)
      if (wanted && !row.slug.startsWith(wanted)) newSlug = await freeSlug(db, wanted, row.id)
    }
    if (newSlug) {
      set.slug = newSlug
      if (row.firstPublishedAt)
        await db
          .insert(contentRedirects)
          .values({ entityType: ENTITY, entityId: row.id, fromPath: row.slug })
          .onConflictDoNothing()
    }
    const [next] = await db
      .update(sermons)
      .set({ ...set, updatedBy: actor?.userId })
      .where(eq(sermons.id, row.id))
      .returning()
    if (!next) return fail(c, 404, 'not_found')
    await saveRevision(db, next, actor?.userId ?? null, 'autosave', false)
    await syncUsages(db, next)
    if (next.state === 'published') await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: ENTITY,
      entityId: row.id,
      summaryFr: 'Prédication modifiée',
      summaryEn: 'Sermon edited',
      // Which fields, never the content (a preacher's name or a link stays out of the log).
      diff: { fields: Object.keys(patch) },
    })
    return c.json({ ok: true, slug: next.slug, updatedAt: next.updatedAt })
  })
  .route('/', lifecycle.router)
