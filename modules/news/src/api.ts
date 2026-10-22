/**
 * News API, mounted at /api/news.
 * - Staff: list, read, write (autosave), publish / schedule / unpublish / archive, revisions, preview links.
 *   Rights are per group: someone who may edit the Jeunesse group's news cannot touch another group's.
 * - Public: edge-cached list, detail and RSS feed; only what is live now, in the visitor's language
 *   (French shown, with a note, when the English text does not exist yet).
 */
import {
  type AppEnv,
  audit,
  bumpContentVersion,
  cachedJson,
  contentRoutes,
  fail,
  mayOn,
  requirePermissionAnywhere,
  verifyPreview,
  versionFor,
} from '@eec/api-kit'
import { type Principal, scopeFor } from '@eec/auth'
import {
  cleanDoc,
  isEmptyDoc,
  plainText,
  publishProblems,
  renderHtml,
  slugify,
  statusOf,
  uniqueSlug,
} from '@eec/core'
import type { Db } from '@eec/db'
import { contentRedirects, groups, mediaFiles } from '@eec/db/schema'
import { and, desc, eq, ilike, inArray, isNull, lte, or, type SQL, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { newsPosts } from './schema.ts'

const AREA = 'news'
const ENTITY = 'news'
const PAGE = 12

type Row = typeof newsPosts.$inferSelect

const date = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s))
  .nullable()
const doc = z
  .unknown()
  .refine((v) => JSON.stringify(v ?? null).length < 400_000, 'too_large')
  .transform((v) => cleanDoc(v))

export const patchSchema = z
  .object({
    titleFr: z.string().max(200),
    titleEn: z.string().max(200),
    excerptFr: z.string().max(400),
    excerptEn: z.string().max(400),
    bodyFr: doc,
    bodyEn: doc,
    coverMediaId: z.string().uuid().nullable(),
    groupId: z.string().uuid().nullable(),
    pinned: z.boolean(),
    slug: z.string().max(120),
  })
  .partial()
  .strict()

const _publishSchema = z
  .object({ publishAt: date.optional(), unpublishAt: date.optional() })
  .strict()

const slugOf = (title: string) => slugify(title).slice(0, 80)

async function freeSlug(db: Db, base: string, except?: string) {
  const like = `${base}%`
  const rows = await db
    .select({ slug: newsPosts.slug, id: newsPosts.id })
    .from(newsPosts)
    .where(ilike(newsPosts.slug, like))
  const taken = new Set(rows.filter((r) => r.id !== except).map((r) => r.slug))
  return uniqueSlug(base, (s) => taken.has(s))
}

const snapshotOf = (r: Row) => ({
  titleFr: r.titleFr,
  titleEn: r.titleEn,
  excerptFr: r.excerptFr,
  excerptEn: r.excerptEn,
  bodyFr: r.bodyFr,
  bodyEn: r.bodyEn,
  coverMediaId: r.coverMediaId,
  groupId: r.groupId,
  pinned: r.pinned,
  slug: r.slug,
})

const lifecycleOf = (r: Row) => ({
  state: r.state as 'draft' | 'published' | 'archived',
  publishAt: r.publishAt,
  unpublishAt: r.unpublishAt,
})

const adminDto = (r: Row, groupName?: string | null) => ({
  id: r.id,
  slug: r.slug,
  status: statusOf(lifecycleOf(r)),
  state: r.state,
  groupId: r.groupId,
  groupName: groupName ?? null,
  publishAt: r.publishAt,
  unpublishAt: r.unpublishAt,
  firstPublishedAt: r.firstPublishedAt,
  pinned: r.pinned,
  titleFr: r.titleFr,
  titleEn: r.titleEn,
  excerptFr: r.excerptFr,
  excerptEn: r.excerptEn,
  coverMediaId: r.coverMediaId,
  updatedAt: r.updatedAt,
})

/** Live right now: published, its start date passed, its end date not reached. */
const liveNow = () =>
  and(
    eq(newsPosts.state, 'published'),
    or(isNull(newsPosts.publishAt), lte(newsPosts.publishAt, sql`now()`)),
    or(isNull(newsPosts.unpublishAt), sql`${newsPosts.unpublishAt} > now()`),
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

type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')

async function publicItems(db: Db, locale: Locale, offset: number, limit: number, ids?: string[]) {
  const rows = await db
    .select()
    .from(newsPosts)
    .where(and(liveNow(), ids ? inArray(newsPosts.id, ids) : undefined))
    .orderBy(
      desc(newsPosts.pinned),
      desc(
        sql`coalesce(${newsPosts.publishAt}, ${newsPosts.firstPublishedAt}, ${newsPosts.createdAt})`,
      ),
    )
    .offset(offset)
    .limit(limit + 1)
  return rowsToPublic(db, rows.slice(0, limit), locale, rows.length > limit)
}

async function rowsToPublic(db: Db, rows: Row[], locale: Locale, more: boolean) {
  const mediaIds = rows.map((r) => r.coverMediaId).filter((x): x is string => !!x)
  const groupIds = rows.map((r) => r.groupId).filter((x): x is string => !!x)
  const [media, grp] = await Promise.all([
    mediaIds.length
      ? db.select().from(mediaFiles).where(inArray(mediaFiles.id, mediaIds))
      : Promise.resolve([]),
    groupIds.length
      ? db.select().from(groups).where(inArray(groups.id, groupIds))
      : Promise.resolve([]),
  ])
  return {
    more,
    items: rows.map((r) => {
      const en = locale === 'en' && r.titleEn.trim() !== ''
      const g = grp.find((x) => x.id === r.groupId)
      return {
        id: r.id,
        slug: r.slug,
        title: en ? r.titleEn : r.titleFr,
        excerpt:
          (en ? r.excerptEn : r.excerptFr) || plainText(en ? r.bodyEn : r.bodyFr).slice(0, 200),
        fallback: locale === 'en' && !en,
        publishedAt: (r.publishAt ?? r.firstPublishedAt ?? r.createdAt).toISOString(),
        pinned: r.pinned,
        group: g ? (locale === 'en' && g.nameEn ? g.nameEn : g.nameFr) : null,
        cover: mediaOut(media.find((m) => m.id === r.coverMediaId)),
      }
    }),
  }
}

async function publicDetail(db: Db, row: Row, locale: Locale) {
  const { items } = await rowsToPublic(db, [row], locale, false)
  const en = locale === 'en' && row.titleEn.trim() !== ''
  const body = en ? row.bodyEn : row.bodyFr
  return {
    ...(items[0] as NonNullable<(typeof items)[number]>),
    html: renderHtml(body),
    text: plainText(body).slice(0, 5000),
  }
}

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)

function feedXml(
  origin: string,
  locale: Locale,
  items: Awaited<ReturnType<typeof publicItems>>['items'],
) {
  const base = `${origin}/${locale}/${locale === 'fr' ? 'actualites/nouvelles' : 'news/latest'}`
  const title = locale === 'fr' ? 'EEC Nkolndongo 1 — Actualités' : 'EEC Nkolndongo 1 — News'
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(title)}</title><link>${xml(base)}</link><description>${xml(title)}</description><language>${locale}</language>${items
    .map(
      (i) =>
        `<item><title>${xml(i.title)}</title><link>${xml(`${base}/${i.slug}`)}</link><guid isPermaLink="true">${xml(`${base}/${i.slug}`)}</guid><pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate><description>${xml(i.excerpt)}</description></item>`,
    )
    .join('')}</channel></rss>`
}

const lifecycle = contentRoutes<Row>({
  entity: ENTITY,
  area: AREA,
  table: newsPosts,
  perms: { read: 'news:read', edit: 'news:edit', publish: 'news:publish', delete: 'news:delete' },
  labels: {
    published: { fr: 'Actualité publiée', en: 'News post published' },
    scheduled: { fr: 'Actualité programmée', en: 'News post scheduled' },
    unpublished: { fr: 'Actualité retirée du site', en: 'News post taken off the site' },
    archived: { fr: 'Actualité archivée', en: 'News post archived' },
    deleted: { fr: 'Actualité supprimée', en: 'News post deleted' },
    restored: { fr: 'Ancienne version restaurée', en: 'Earlier version restored' },
  },
  snapshotOf,
  restoreSet: (s: ReturnType<typeof snapshotOf>) => ({
    titleFr: s.titleFr,
    titleEn: s.titleEn,
    excerptFr: s.excerptFr,
    excerptEn: s.excerptEn,
    bodyFr: cleanDoc(s.bodyFr),
    bodyEn: cleanDoc(s.bodyEn),
    coverMediaId: s.coverMediaId,
    pinned: s.pinned,
  }),
  problems: (row, dates) =>
    publishProblems({ title: row.titleFr, bodyEmpty: isEmptyDoc(row.bodyFr), ...dates }),
  mediaIdsOf: (row) => {
    const out: { id: string; field: string }[] = []
    if (row.coverMediaId) out.push({ id: row.coverMediaId, field: 'cover' })
    for (const body of [row.bodyFr, row.bodyEn])
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

export const newsApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const page = Math.max(1, Math.min(Number(c.req.query('page')) || 1, 200))
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || PAGE, 1), 24)
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `news/list/${locale}/${page}/${limit}/v${version}`,
      ttl: 60,
      keep: 60 * 60 * 24 * 7,
      load: (db) => publicItems(db, locale, (page - 1) * limit, limit),
    })
  })
  .get('/public/feed.xml', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `news/feed/${locale}/v${version}`,
      ttl: 300,
      keep: 60 * 60 * 24 * 7,
      contentType: 'application/rss+xml; charset=utf-8',
      load: async (db) => (await publicItems(db, locale, 0, 20)).items,
      serialize: (items) => feedXml(c.env.APP_ORIGIN, locale, items),
    })
  })
  .get('/public/item/:slug', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const slug = c.req.param('slug')
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `news/item/${locale}/${slug}/v${version}`,
      ttl: 60,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const [row] = await db
          .select()
          .from(newsPosts)
          .where(and(eq(newsPosts.slug, slug), liveNow()))
          .limit(1)
        if (row) return { found: true as const, post: await publicDetail(db, row, locale) }
        // An old address after the title (and so the address) changed.
        const [moved] = await db
          .select({ id: contentRedirects.entityId })
          .from(contentRedirects)
          .where(and(eq(contentRedirects.entityType, ENTITY), eq(contentRedirects.fromPath, slug)))
          .limit(1)
        const [target] = moved
          ? await db
              .select({ slug: newsPosts.slug })
              .from(newsPosts)
              .where(and(eq(newsPosts.id, moved.id), liveNow()))
          : []
        return { found: false as const, redirect: target?.slug ?? null }
      },
    })
  })
  // Opened through a preview link: any state, never indexed or cached.
  .get('/public/preview/:token', async (c) => {
    const id = await verifyPreview(c.env.AUTH_SECRET, c.req.param('token'), ENTITY)
    if (!id) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1)
    if (!row) return fail(c, 404, 'not_found')
    const post = await publicDetail(db, row, localeOf(c.req.query('locale')))
    return c.json(post, 200, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' })
  })

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermissionAnywhere('news:read'), async (c) => {
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const scope = scopeFor(actor?.principal as Principal, 'news:read')
    const q = c.req.query()
    const where: (SQL | undefined)[] = []
    if (scope !== 'all')
      where.push(
        inArray(newsPosts.groupId, scope.length ? scope : ['00000000-0000-0000-0000-000000000000']),
      )
    if (q.q)
      where.push(or(ilike(newsPosts.titleFr, `%${q.q}%`), ilike(newsPosts.titleEn, `%${q.q}%`)))
    if (q.group) where.push(eq(newsPosts.groupId, q.group))
    const rows = await db
      .select({ post: newsPosts, groupName: groups.nameFr })
      .from(newsPosts)
      .leftJoin(groups, eq(groups.id, newsPosts.groupId))
      .where(and(...where))
      .orderBy(desc(newsPosts.updatedAt))
      .limit(300)
    let items = rows.map((r) => adminDto(r.post, r.groupName))
    if (q.status && ['draft', 'scheduled', 'published', 'archived'].includes(q.status))
      items = items.filter((i) => i.status === q.status)
    const counts = { draft: 0, scheduled: 0, published: 0, archived: 0 }
    for (const r of rows) counts[statusOf(lifecycleOf(r.post))]++
    return c.json({ items, counts })
  })
  .get('/:id', requirePermissionAnywhere('news:read'), async (c) => {
    const r = await load(c, c.req.param('id'), 'news:read')
    if (r.error) return r.error
    return c.json({
      ...adminDto(r.row),
      bodyFr: r.row.bodyFr,
      bodyEn: r.row.bodyEn,
    })
  })
  .post('/', requirePermissionAnywhere('news:edit'), async (c) => {
    const body = z
      .object({
        titleFr: z.string().max(200).default(''),
        groupId: z.string().uuid().nullable().default(null),
      })
      .safeParse(await c.req.json().catch(() => ({})))
    if (!body.success) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'news:edit', body.data.groupId))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const slug = await freeSlug(db, slugOf(body.data.titleFr) || 'sans-titre')
    const [row] = await db
      .insert(newsPosts)
      .values({
        slug,
        titleFr: body.data.titleFr,
        groupId: body.data.groupId,
        createdBy: actor?.userId,
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: ENTITY,
      entityId: row.id,
      summaryFr: 'Actualité créée',
      summaryEn: 'News post created',
    })
    return c.json({ id: row.id }, 201)
  })
  // Autosave: only the sent fields change.
  .patch('/:id', requirePermissionAnywhere('news:edit'), async (c) => {
    const r = await load(c, c.req.param('id'), 'news:edit')
    if (r.error) return r.error
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const { db, row } = r
    const patch = parsed.data
    if (patch.groupId !== undefined && patch.groupId !== row.groupId) {
      if (!(await mayOn(c, 'news:edit', patch.groupId))) return fail(c, 403, 'forbidden')
    }
    if (patch.coverMediaId) {
      const [m] = await db
        .select({ kind: mediaFiles.kind })
        .from(mediaFiles)
        .where(eq(mediaFiles.id, patch.coverMediaId))
      if (m?.kind !== 'image') return fail(c, 400, 'invalid')
    }
    const set: Partial<typeof newsPosts.$inferInsert> = {}
    for (const k of [
      'titleFr',
      'titleEn',
      'excerptFr',
      'excerptEn',
      'bodyFr',
      'bodyEn',
      'coverMediaId',
      'groupId',
      'pinned',
    ] as const)
      if (patch[k] !== undefined) (set as Record<string, unknown>)[k] = patch[k]
    // The address follows the title until the first publication; after that only an explicit change moves it.
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
    const actor = await c.var.deps.actor()
    const [next] = await db
      .update(newsPosts)
      .set({ ...set, updatedBy: actor?.userId })
      .where(eq(newsPosts.id, row.id))
      .returning()
    if (!next) return fail(c, 404, 'not_found')
    await saveRevision(db, next, actor?.userId ?? null, 'autosave', false)
    await syncUsages(db, next)
    if (next.state === 'published') await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: ENTITY,
      entityId: row.id,
      summaryFr: 'Actualité modifiée',
      summaryEn: 'News post edited',
      diff: { fields: Object.keys(patch) },
    })
    return c.json({ ok: true, slug: next.slug, updatedAt: next.updatedAt })
  })
  .route('/', lifecycle.router)
