/**
 * Events API, mounted at /api/events.
 * - Staff: list, calendar window (drafts included), write (autosave), duplicate; publish, schedule, archive,
 *   versions and preview come from the shared content routes. Rights are per group.
 * - Public (edge-cached): occurrences in a window, the next ones, one event with its coming dates, and calendar
 *   files (.ics per event, and a subscribable feed, optionally for one group).
 * Occurrences are expanded here, on the server, by the tested function in @eec/core (decision 0029).
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
  buildIcs,
  cleanDoc,
  EVENT_KINDS,
  expandOccurrences,
  type IcsEvent,
  MAX_WINDOW_DAYS,
  nextOccurrence,
  type Occurrence,
  plainText,
  publishProblems,
  renderHtml,
  type Schedulable,
  slugify,
  statusOf,
  uniqueSlug,
} from '@eec/core'
import type { Db } from '@eec/db'
import { groups, mediaFiles } from '@eec/db/schema'
import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, type SQL, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { eventsItems } from './schema.ts'

const AREA = 'events'
const ENTITY = 'events'
const DAY = 86_400_000

type Row = typeof eventsItems.$inferSelect
type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')

/* ── Validation ───────────────────────────────────────────────────────── */
const instant = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s))
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const weekday = z.number().int().min(0).max(6)
const ends = { until: localDate.nullish(), count: z.number().int().min(1).max(1000).nullish() }
const interval = z.number().int().min(1).max(12).optional()
const recurrence = z.union([
  z
    .object({ freq: z.literal('weekly'), byDay: z.array(weekday).min(1).max(7), interval, ...ends })
    .strict(),
  z
    .object({
      freq: z.literal('monthly'),
      mode: z.literal('nthWeekday'),
      nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
      weekday,
      interval,
      ...ends,
    })
    .strict(),
  z
    .object({
      freq: z.literal('monthly'),
      mode: z.literal('monthday'),
      day: z.number().int().min(1).max(31),
      interval,
      ...ends,
    })
    .strict(),
])
const exception = z.object({
  date: localDate,
  kind: z.enum(['cancelled', 'moved']),
  noteFr: z.string().max(200).optional(),
  noteEn: z.string().max(200).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).nullish(),
})
const doc = z
  .unknown()
  .refine((v) => JSON.stringify(v ?? null).length < 400_000, 'too_large')
  .transform((v) => cleanDoc(v))
const https = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), 'https_only')

export const patchSchema = z
  .object({
    titleFr: z.string().max(200),
    titleEn: z.string().max(200),
    descriptionFr: doc,
    descriptionEn: doc,
    startsAt: instant,
    endsAt: instant.nullable(),
    allDay: z.boolean(),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz })
        return true
      } catch {
        return false
      }
    }, 'bad_timezone'),
    recurrence: recurrence.nullable(),
    exceptions: z.array(exception).max(300),
    locationKind: z.enum(['temple', 'other']),
    locationFr: z.string().max(200),
    locationEn: z.string().max(200),
    registrationUrl: https
      .max(500)
      .nullable()
      .or(z.literal('').transform(() => null)),
    coverMediaId: z.string().uuid().nullable(),
    groupId: z.string().uuid().nullable(),
    featured: z.boolean(),
    kind: z.enum(EVENT_KINDS),
    slug: z.string().max(120),
  })
  .partial()
  .strict()

const slugOf = (title: string) => slugify(title).slice(0, 80)
async function freeSlug(db: Db, base: string, except?: string) {
  const rows = await db
    .select({ slug: eventsItems.slug, id: eventsItems.id })
    .from(eventsItems)
    .where(ilike(eventsItems.slug, `${base}%`))
  const taken = new Set(rows.filter((r) => r.id !== except).map((r) => r.slug))
  return uniqueSlug(base, (s) => taken.has(s))
}

/* ── Shared lifecycle routes ──────────────────────────────────────────── */
const snapshotOf = (r: Row) => ({
  titleFr: r.titleFr,
  titleEn: r.titleEn,
  descriptionFr: r.descriptionFr,
  descriptionEn: r.descriptionEn,
  startsAt: r.startsAt.toISOString(),
  endsAt: r.endsAt?.toISOString() ?? null,
  allDay: r.allDay,
  timezone: r.timezone,
  recurrence: r.recurrence,
  exceptions: r.exceptions,
  locationKind: r.locationKind,
  locationFr: r.locationFr,
  locationEn: r.locationEn,
  registrationUrl: r.registrationUrl,
  coverMediaId: r.coverMediaId,
  featured: r.featured,
  kind: r.kind,
  slug: r.slug,
})

const lifecycle = contentRoutes<Row>({
  entity: ENTITY,
  area: AREA,
  table: eventsItems,
  perms: {
    read: 'events:read',
    edit: 'events:edit',
    publish: 'events:publish',
    delete: 'events:delete',
  },
  labels: {
    published: { fr: 'Événement publié', en: 'Event published' },
    scheduled: { fr: 'Événement programmé', en: 'Event scheduled' },
    unpublished: { fr: 'Événement retiré du site', en: 'Event taken off the site' },
    archived: { fr: 'Événement archivé', en: 'Event archived' },
    deleted: { fr: 'Événement supprimé', en: 'Event deleted' },
    restored: { fr: 'Ancienne version restaurée', en: 'Earlier version restored' },
  },
  snapshotOf,
  restoreSet: (s: ReturnType<typeof snapshotOf>) => ({
    titleFr: s.titleFr,
    titleEn: s.titleEn,
    descriptionFr: cleanDoc(s.descriptionFr),
    descriptionEn: cleanDoc(s.descriptionEn),
    startsAt: new Date(s.startsAt),
    endsAt: s.endsAt ? new Date(s.endsAt) : null,
    allDay: s.allDay,
    timezone: s.timezone,
    recurrence: s.recurrence,
    exceptions: s.exceptions,
    locationKind: s.locationKind,
    locationFr: s.locationFr,
    locationEn: s.locationEn,
    registrationUrl: s.registrationUrl,
    coverMediaId: s.coverMediaId,
    featured: s.featured,
    kind: s.kind ?? 'autre',
  }),
  problems: (row, dates) => publishProblems({ title: row.titleFr, bodyEmpty: false, ...dates }),
  mediaIdsOf: (row) => {
    const out: { id: string; field: string }[] = []
    if (row.coverMediaId) out.push({ id: row.coverMediaId, field: 'cover' })
    for (const body of [row.descriptionFr, row.descriptionEn])
      for (const m of JSON.stringify(body).matchAll(/"mediaId":"([0-9a-f-]{36})"/g))
        if (m[1]) out.push({ id: m[1], field: 'body' })
    return out
  },
  revisionLabel: (s: ReturnType<typeof snapshotOf>) => ({
    title: s.titleFr,
    words: plainText(s.descriptionFr).split(' ').filter(Boolean).length,
  }),
})
const { load, saveRevision, syncUsages } = lifecycle

/* ── Helpers ──────────────────────────────────────────────────────────── */
const lifecycleOf = (r: Row) => ({
  state: r.state as 'draft' | 'published' | 'archived',
  publishAt: r.publishAt,
  unpublishAt: r.unpublishAt,
})
const liveNow = () =>
  and(
    eq(eventsItems.state, 'published'),
    or(isNull(eventsItems.publishAt), lte(eventsItems.publishAt, sql`now()`)),
    or(isNull(eventsItems.unpublishAt), sql`${eventsItems.unpublishAt} > now()`),
  ) as SQL

const schedulable = (r: Row): Schedulable => ({
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  allDay: r.allDay,
  timezone: r.timezone,
  recurrence: r.recurrence,
  exceptions: r.exceptions ?? [],
})

const adminDto = (r: Row, groupName?: string | null) => {
  const next = nextOccurrence(schedulable(r), new Date(Date.now() - 3_600_000))
  return {
    id: r.id,
    slug: r.slug,
    status: statusOf(lifecycleOf(r)),
    groupId: r.groupId,
    groupName: groupName ?? null,
    publishAt: r.publishAt,
    unpublishAt: r.unpublishAt,
    featured: r.featured,
    kind: r.kind,
    titleFr: r.titleFr,
    titleEn: r.titleEn,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    allDay: r.allDay,
    timezone: r.timezone,
    recurrence: r.recurrence,
    exceptions: r.exceptions,
    updatedAt: r.updatedAt,
    nextAt: next?.startsAt.toISOString() ?? null,
    nextEndsAt: next?.endsAt?.toISOString() ?? null,
  }
}

const windowOf = (from: string | undefined, to: string | undefined, defaultDays: number) => {
  const start =
    from && /^\d{4}-\d{2}-\d{2}$/.test(from)
      ? new Date(`${from}T00:00:00Z`)
      : new Date(Math.floor(Date.now() / DAY) * DAY)
  const wanted =
    to && /^\d{4}-\d{2}-\d{2}$/.test(to)
      ? new Date(`${to}T00:00:00Z`)
      : new Date(start.getTime() + defaultDays * DAY)
  const end = new Date(Math.min(wanted.getTime(), start.getTime() + MAX_WINDOW_DAYS * DAY))
  // A day of slack each side: the window is in UTC dates, events are in their own zone.
  return { from: new Date(start.getTime() - DAY), to: new Date(end.getTime() + DAY), start, end }
}

type PublicOcc = {
  eventId: string
  slug: string
  title: string
  description: string
  date: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  cancelled: boolean
  moved: boolean
  note: string
  location: string
  locationKind: string
  fallback: boolean
  featured: boolean
  kind: string
  group: string | null
  groupKey: string | null
  cover: unknown
  registrationUrl: string | null
}

async function coversAndGroups(db: Db, rows: Row[]) {
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
  return { media, grp }
}

function toPublic(
  ctx: Awaited<ReturnType<typeof coversAndGroups>>,
  locale: Locale,
  occs: { row: Row; o: Occurrence }[],
): PublicOcc[] {
  return occs.map(({ row: r, o }) => {
    const en = locale === 'en' && r.titleEn.trim() !== ''
    const g = ctx.grp.find((x) => x.id === r.groupId)
    const m = ctx.media.find((x) => x.id === r.coverMediaId)
    return {
      eventId: r.id,
      slug: r.slug,
      title: en ? r.titleEn : r.titleFr,
      description: plainText(en ? r.descriptionEn : r.descriptionFr).slice(0, 220),
      date: o.date,
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt?.toISOString() ?? null,
      allDay: r.allDay,
      cancelled: o.cancelled,
      moved: o.moved,
      note: (locale === 'en' ? o.noteEn || o.noteFr : o.noteFr) ?? '',
      location: (locale === 'en' && r.locationEn ? r.locationEn : r.locationFr) ?? '',
      locationKind: r.locationKind,
      fallback: locale === 'en' && !en,
      featured: r.featured,
      kind: r.kind,
      group: g ? (locale === 'en' && g.nameEn ? g.nameEn : g.nameFr) : null,
      groupKey: g?.key ?? null,
      cover: m
        ? {
            variants: m.variants,
            placeholder: m.placeholder,
            altFr: m.altFr,
            altEn: m.altEn,
            width: m.width,
            height: m.height,
            credit: m.credit,
          }
        : null,
      registrationUrl: r.registrationUrl,
    }
  })
}

async function liveRows(db: Db, groupKey?: string | null) {
  const rows = await db
    .select()
    .from(eventsItems)
    .where(liveNow())
    .orderBy(asc(eventsItems.startsAt))
    .limit(500)
  if (!groupKey) return rows
  const [g] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.key, groupKey))
    .limit(1)
  return g ? rows.filter((r) => r.groupId === g.id) : []
}

async function occurrencesIn(
  db: Db,
  locale: Locale,
  from: Date,
  to: Date,
  opts: { group?: string | null; limit?: number; hideCancelled?: boolean },
) {
  const rows = await liveRows(db, opts.group)
  const all = rows.flatMap((row) =>
    expandOccurrences(schedulable(row), from, to)
      .filter((o) => (opts.hideCancelled ? !o.cancelled : true))
      .map((o) => ({ row, o })),
  )
  all.sort(
    (a, b) =>
      a.o.startsAt.getTime() - b.o.startsAt.getTime() || a.row.titleFr.localeCompare(b.row.titleFr),
  )
  const slice = opts.limit ? all.slice(0, opts.limit) : all
  const ctx = await coversAndGroups(
    db,
    slice.map((x) => x.row),
  )
  return toPublic(ctx, locale, slice)
}

const pagePath = (locale: Locale) => (locale === 'fr' ? 'agenda/evenements' : 'calendar/events')

function icsEventOf(r: Row, origin: string, locale: Locale): IcsEvent {
  const en = locale === 'en' && r.titleEn.trim() !== ''
  const desc = plainText(en ? r.descriptionEn : r.descriptionFr)
  const url = `${origin}/${locale}/${pagePath(locale)}/${r.slug}/`
  return {
    ...schedulable(r),
    id: r.id,
    title: en ? r.titleEn : r.titleFr,
    description: desc ? `${desc}\n\n${url}` : url,
    location: (locale === 'en' && r.locationEn ? r.locationEn : r.locationFr) || undefined,
    url,
    updatedAt: r.updatedAt,
  }
}

/* ── Router ───────────────────────────────────────────────────────────── */
export const eventsApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const w = windowOf(c.req.query('from'), c.req.query('to'), 90)
    const group =
      c.req.query('group') && /^[a-z0-9-]{1,40}$/.test(c.req.query('group') as string)
        ? (c.req.query('group') as string)
        : null
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `events/list/${locale}/${w.start.toISOString().slice(0, 10)}/${w.end.toISOString().slice(0, 10)}/${group ?? '-'}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => ({ items: await occurrencesIn(db, locale, w.start, w.end, { group }) }),
    })
  })
  // The next few occurrences (home « Prochainement », the Agenda menu highlight).
  .get('/public/next', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 3, 1), 12)
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    const day = new Date().toISOString().slice(0, 13) // refreshed hourly
    return cachedJson(c, {
      key: `events/next/${locale}/${limit}/${day}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const now = new Date()
        const all = await occurrencesIn(
          db,
          locale,
          new Date(now.getTime() - 3 * 3_600_000),
          new Date(now.getTime() + 200 * DAY),
          { hideCancelled: true },
        )
        const upcoming = all.filter((o) => new Date(o.endsAt ?? o.startsAt) >= now)
        // A featured event first when it is within the next 30 days.
        const soon = upcoming.filter(
          (o) => o.featured && new Date(o.startsAt) < new Date(now.getTime() + 30 * DAY),
        )
        const rest = upcoming.filter((o) => !soon.includes(o))
        return { items: [...soon.slice(0, 1), ...rest].slice(0, limit) }
      },
    })
  })
  .get('/public/calendar.ics', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const group =
      c.req.query('group') && /^[a-z0-9-]{1,40}$/.test(c.req.query('group') as string)
        ? (c.req.query('group') as string)
        : null
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `events/ics/${locale}/${group ?? '-'}/v${version}`,
      ttl: 600,
      keep: 60 * 60 * 24 * 7,
      contentType: 'text/calendar; charset=utf-8',
      load: async (db) =>
        (await liveRows(db, group)).map((r) => icsEventOf(r, c.env.APP_ORIGIN, locale)),
      serialize: (events) =>
        buildIcs({
          name: locale === 'fr' ? 'EEC Nkolndongo 1 — Agenda' : 'EEC Nkolndongo 1 — Calendar',
          events,
        }),
    })
  })
  .get('/public/item/:slug/event.ics', async (c) => {
    const slug = c.req.param('slug')
    const locale = localeOf(c.req.query('locale'))
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    const res = await cachedJson(c, {
      key: `events/item-ics/${locale}/${slug}/v${version}`,
      ttl: 600,
      keep: 60 * 60 * 24 * 7,
      contentType: 'text/calendar; charset=utf-8',
      load: async (db) => {
        const [row] = await db
          .select()
          .from(eventsItems)
          .where(and(eq(eventsItems.slug, slug), liveNow()))
          .limit(1)
        return row ? [icsEventOf(row, c.env.APP_ORIGIN, locale)] : []
      },
      serialize: (events) => buildIcs({ name: events[0]?.title ?? 'Agenda', events }),
    })
    return res
  })
  .get('/public/item/:slug', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const slug = c.req.param('slug')
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `events/item/${locale}/${slug}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const [row] = await db
          .select()
          .from(eventsItems)
          .where(and(eq(eventsItems.slug, slug), liveNow()))
          .limit(1)
        if (!row) return { found: false as const }
        return { found: true as const, event: await detail(db, row, locale) }
      },
    })
  })
  // Opened through a preview link: any state, never indexed or cached.
  .get('/public/preview/:token', async (c) => {
    const id = await verifyPreview(c.env.AUTH_SECRET, c.req.param('token'), ENTITY)
    if (!id) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db.select().from(eventsItems).where(eq(eventsItems.id, id)).limit(1)
    if (!row) return fail(c, 404, 'not_found')
    return c.json(await detail(db, row, localeOf(c.req.query('locale'))), 200, {
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    })
  })

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermissionAnywhere('events:read'), async (c) => {
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const scope = scopeFor(actor?.principal as Principal, 'events:read')
    const q = c.req.query()
    const where: (SQL | undefined)[] = []
    if (scope !== 'all')
      where.push(
        inArray(
          eventsItems.groupId,
          scope.length ? scope : ['00000000-0000-0000-0000-000000000000'],
        ),
      )
    if (q.q)
      where.push(or(ilike(eventsItems.titleFr, `%${q.q}%`), ilike(eventsItems.titleEn, `%${q.q}%`)))
    if (q.group) where.push(eq(eventsItems.groupId, q.group))
    const rows = await db
      .select({ ev: eventsItems, groupName: groups.nameFr })
      .from(eventsItems)
      .leftJoin(groups, eq(groups.id, eventsItems.groupId))
      .where(and(...where))
      .orderBy(desc(eventsItems.startsAt))
      .limit(300)
    let items = rows.map((r) => adminDto(r.ev, r.groupName))
    if (q.status && ['draft', 'scheduled', 'published', 'archived'].includes(q.status))
      items = items.filter((i) => i.status === q.status)
    const counts = { draft: 0, scheduled: 0, published: 0, archived: 0 }
    for (const r of rows) counts[statusOf(lifecycleOf(r.ev))]++
    return c.json({ items, counts })
  })
  // The calendar view: every occurrence in a window, drafts included.
  .get('/calendar', requirePermissionAnywhere('events:read'), async (c) => {
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const scope = scopeFor(actor?.principal as Principal, 'events:read')
    const w = windowOf(c.req.query('from'), c.req.query('to'), 42)
    const rows = (
      await db.select().from(eventsItems).where(sql`${eventsItems.state} <> 'archived'`).limit(500)
    ).filter((r) => scope === 'all' || (r.groupId && scope.includes(r.groupId)))
    const items = rows
      .flatMap((row) =>
        expandOccurrences(schedulable(row), w.start, w.end).map((o) => ({
          id: row.id,
          title: row.titleFr || '—',
          status: statusOf(lifecycleOf(row)),
          date: o.date,
          startsAt: o.startsAt.toISOString(),
          endsAt: o.endsAt?.toISOString() ?? null,
          allDay: row.allDay,
          cancelled: o.cancelled,
          moved: o.moved,
          recurring: !!row.recurrence,
          kind: row.kind,
        })),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    return c.json({ items })
  })
  .get('/:id', requirePermissionAnywhere('events:read'), async (c) => {
    const r = await load(c, c.req.param('id'), 'events:read')
    if (r.error) return r.error
    return c.json({
      ...adminDto(r.row),
      descriptionFr: r.row.descriptionFr,
      descriptionEn: r.row.descriptionEn,
      locationKind: r.row.locationKind,
      locationFr: r.row.locationFr,
      locationEn: r.row.locationEn,
      registrationUrl: r.row.registrationUrl,
      coverMediaId: r.row.coverMediaId,
    })
  })
  .post('/', requirePermissionAnywhere('events:edit'), async (c) => {
    const body = z
      .object({
        titleFr: z.string().max(200).default(''),
        groupId: z.string().uuid().nullable().default(null),
        startsAt: instant.optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})))
    if (!body.success) return fail(c, 400, 'invalid')
    if (!(await mayOn(c, 'events:edit', body.data.groupId))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    // Default: next Sunday 09:00 local (UTC+1 for Douala).
    const now = new Date()
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + ((7 - now.getUTCDay()) % 7 || 7),
        8,
        0,
      ),
    )
    const slug = await freeSlug(db, slugOf(body.data.titleFr) || 'evenement')
    const [row] = await db
      .insert(eventsItems)
      .values({
        slug,
        titleFr: body.data.titleFr,
        groupId: body.data.groupId,
        startsAt: body.data.startsAt ?? next,
        createdBy: actor?.userId,
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: ENTITY,
      entityId: row.id,
      summaryFr: 'Événement créé',
      summaryEn: 'Event created',
    })
    return c.json({ id: row.id }, 201)
  })
  .post('/:id/duplicate', requirePermissionAnywhere('events:edit'), async (c) => {
    const r = await load(c, c.req.param('id'), 'events:edit')
    if (r.error) return r.error
    const actor = await c.var.deps.actor()
    const copy = { ...r.row } as Partial<Row>
    for (const k of [
      'id',
      'createdAt',
      'updatedAt',
      'firstPublishedAt',
      'publishAt',
      'unpublishAt',
    ] as const)
      delete copy[k]
    const [row] = await r.db
      .insert(eventsItems)
      .values({
        ...(copy as Omit<Row, 'id'>),
        slug: await freeSlug(r.db, slugOf(`${r.row.titleFr}-copie`) || 'evenement'),
        state: 'draft',
        exceptions: [],
        titleFr: `${r.row.titleFr} (copie)`,
        createdBy: actor?.userId,
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await syncUsages(r.db, row)
    await audit(c, {
      action: 'create',
      entityType: ENTITY,
      entityId: row.id,
      summaryFr: 'Événement dupliqué',
      summaryEn: 'Event duplicated',
    })
    return c.json({ id: row.id }, 201)
  })
  // Autosave: only the sent fields change.
  .patch('/:id', requirePermissionAnywhere('events:edit'), async (c) => {
    const r = await load(c, c.req.param('id'), 'events:edit')
    if (r.error) return r.error
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const { db, row } = r
    const patch = parsed.data
    if (
      patch.groupId !== undefined &&
      patch.groupId !== row.groupId &&
      !(await mayOn(c, 'events:edit', patch.groupId))
    )
      return fail(c, 403, 'forbidden')
    if (patch.coverMediaId) {
      const [m] = await db
        .select({ kind: mediaFiles.kind })
        .from(mediaFiles)
        .where(eq(mediaFiles.id, patch.coverMediaId))
      if (m?.kind !== 'image') return fail(c, 400, 'invalid')
    }
    const startsAt = patch.startsAt ?? row.startsAt
    const endsAt = patch.endsAt === undefined ? row.endsAt : patch.endsAt
    if (endsAt && endsAt < startsAt)
      return c.json({ error: { code: 'invalid', field: 'endsAt' } }, 400)
    const set: Record<string, unknown> = {}
    for (const k of [
      'titleFr',
      'titleEn',
      'descriptionFr',
      'descriptionEn',
      'startsAt',
      'endsAt',
      'allDay',
      'timezone',
      'recurrence',
      'exceptions',
      'locationKind',
      'locationFr',
      'locationEn',
      'registrationUrl',
      'coverMediaId',
      'groupId',
      'featured',
    ] as const)
      if (patch[k] !== undefined) set[k] = patch[k]
    // The address follows the title until the first publication; after that only an explicit change moves it.
    let newSlug: string | undefined
    if (patch.slug !== undefined) {
      const wanted = slugOf(patch.slug)
      if (wanted && wanted !== row.slug) newSlug = await freeSlug(db, wanted, row.id)
    } else if (patch.titleFr !== undefined && !row.firstPublishedAt && patch.titleFr.trim()) {
      const wanted = slugOf(patch.titleFr)
      if (wanted && !row.slug.startsWith(wanted)) newSlug = await freeSlug(db, wanted, row.id)
    }
    if (newSlug) set.slug = newSlug
    const actor = await c.var.deps.actor()
    const [next] = await db
      .update(eventsItems)
      .set({ ...set, updatedBy: actor?.userId })
      .where(eq(eventsItems.id, row.id))
      .returning()
    if (!next) return fail(c, 404, 'not_found')
    await saveRevision(db, next, actor?.userId ?? null, 'autosave', false)
    await syncUsages(db, next)
    if (next.state === 'published') await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: ENTITY,
      entityId: row.id,
      summaryFr: 'Événement modifié',
      summaryEn: 'Event edited',
      diff: { fields: Object.keys(patch) },
    })
    return c.json({ ok: true, slug: next.slug, updatedAt: next.updatedAt })
  })
  .route('/', lifecycle.router)

async function detail(db: Db, row: Row, locale: Locale) {
  const ctx = await coversAndGroups(db, [row])
  const now = new Date()
  const occs = expandOccurrences(
    schedulable(row),
    new Date(now.getTime() - DAY),
    new Date(now.getTime() + 400 * DAY),
  )
    .filter((o) => (o.endsAt ?? o.startsAt) >= new Date(now.getTime() - 3_600_000))
    .slice(0, 12)
  const [first] = toPublic(ctx, locale, [
    {
      row,
      o: occs[0] ?? {
        date: row.startsAt.toISOString().slice(0, 10),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        cancelled: false,
        moved: false,
      },
    },
  ])
  const en = locale === 'en' && row.titleEn.trim() !== ''
  return {
    ...(first as PublicOcc),
    html: renderHtml(en ? row.descriptionEn : row.descriptionFr),
    timezone: row.timezone,
    recurring: !!row.recurrence,
    upcoming: toPublic(
      ctx,
      locale,
      occs.map((o) => ({ row, o })),
    ).map((x) => ({
      date: x.date,
      startsAt: x.startsAt,
      endsAt: x.endsAt,
      cancelled: x.cancelled,
      moved: x.moved,
      note: x.note,
    })),
  }
}
