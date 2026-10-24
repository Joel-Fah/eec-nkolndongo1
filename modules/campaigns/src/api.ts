/**
 * Campaigns API, mounted at /api/campaigns (decision 0041).
 * - Public (edge-cached): the current campaign with VALIDATED totals only (never a row, never a donor), and its share card as SVG.
 * - Staff: campaigns (`edit`), amounts received (`progress`, group-scoped), validation by someone else (`validate`), group goals.
 */
import {
  type AppEnv,
  audit,
  bumpContentVersion,
  cachedJson,
  fail,
  mayOn,
  requirePermission,
  requirePermissionAnywhere,
  versionFor,
} from '@eec/api-kit'
import type { Principal } from '@eec/auth'
import { slugify, uniqueSlug } from '@eec/core'
import type { Db } from '@eec/db'
import { groups, mediaFiles, mediaUsages } from '@eec/db/schema'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  amountOk,
  daysLeft,
  daysUntil,
  inSeason,
  mayValidate,
  percentOf,
  phaseOf,
  shareCardSvg,
} from './rules.ts'
import { campaignGroupGoals, campaignProgress, campaigns } from './schema.ts'

const AREA = 'campaigns'
type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
const pick = (l: Locale, fr: string, en: string) => (l === 'en' && en.trim() ? en : fr)
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const text = (max: number) => z.string().trim().max(max)
const uuidRe = /^[0-9a-f-]{36}$/

export const campaignBody = z
  .object({
    titleFr: text(120).min(1),
    titleEn: text(120),
    descriptionFr: text(2000),
    descriptionEn: text(2000),
    startsOn: day,
    endsOn: day,
    goalXaf: z.number().int().min(0).max(5_000_000_000),
    coverMediaId: z.uuid().nullable(),
    state: z.enum(['draft', 'published']),
  })
  .partial()
  .strict()
export const progressBody = z
  .object({
    amountXaf: z.number().int().min(1).max(500_000_000),
    receivedOn: day,
    groupId: z.uuid().nullable(),
    // Internal, never public. The form tells staff not to write a donor's name.
    note: text(120),
  })
  .partial()
  .strict()
export const goalBody = z.object({ goalXaf: z.number().int().min(0).max(5_000_000_000) }).strict()

type Row = typeof campaigns.$inferSelect

/** Validated sums: the whole campaign and each group. `asOf` keeps only what was received on or before that day. */
async function totals(db: Db, campaignId: string, asOf?: string) {
  const rows = await db
    .select({
      groupId: campaignProgress.groupId,
      sum: sql<number>`coalesce(sum(${campaignProgress.amountXaf}), 0)::int`,
    })
    .from(campaignProgress)
    .where(
      and(
        eq(campaignProgress.campaignId, campaignId),
        eq(campaignProgress.validated, true),
        asOf ? lte(campaignProgress.receivedOn, asOf) : undefined,
      ),
    )
    .groupBy(campaignProgress.groupId)
  return {
    raised: rows.reduce((n, r) => n + r.sum, 0),
    byGroup: new Map(rows.filter((r) => r.groupId).map((r) => [r.groupId as string, r.sum])),
  }
}

/** Entered but not yet validated: for staff only. */
async function pendingOf(db: Db, campaignId: string) {
  const [r] = await db
    .select({
      sum: sql<number>`coalesce(sum(${campaignProgress.amountXaf}), 0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(campaignProgress)
    .where(and(eq(campaignProgress.campaignId, campaignId), eq(campaignProgress.validated, false)))
  return { amount: r?.sum ?? 0, entries: r?.n ?? 0 }
}

/** The campaign to show: the one running today, else the next to start, else the latest that ended. */
async function currentCampaign(db: Db, today: string): Promise<Row | undefined> {
  const pub = eq(campaigns.state, 'published')
  const [running] = await db
    .select()
    .from(campaigns)
    .where(and(pub, lte(campaigns.startsOn, today), gte(campaigns.endsOn, today)))
    .orderBy(desc(campaigns.startsOn))
    .limit(1)
  if (running) return running
  const [next] = await db
    .select()
    .from(campaigns)
    .where(and(pub, gte(campaigns.startsOn, today)))
    .orderBy(asc(campaigns.startsOn))
    .limit(1)
  if (next) return next
  const [last] = await db
    .select()
    .from(campaigns)
    .where(pub)
    .orderBy(desc(campaigns.endsOn))
    .limit(1)
  return last
}

async function publicCurrent(db: Db, locale: Locale, today: string, asOf?: string) {
  const c = await currentCampaign(db, today)
  if (!c) return { campaign: null }
  const t = await totals(db, c.id, asOf)
  const goals = await db
    .select({
      groupId: campaignGroupGoals.groupId,
      goal: campaignGroupGoals.goalXaf,
      nameFr: groups.nameFr,
      nameEn: groups.nameEn,
    })
    .from(campaignGroupGoals)
    .innerJoin(groups, eq(groups.id, campaignGroupGoals.groupId))
    .where(eq(campaignGroupGoals.campaignId, c.id))
  const cover = c.coverMediaId
    ? (await db.select().from(mediaFiles).where(eq(mediaFiles.id, c.coverMediaId)))[0]
    : undefined
  const phase = phaseOf(c.startsOn, c.endsOn, today)
  return {
    campaign: {
      slug: c.slug,
      title: pick(locale, c.titleFr, c.titleEn),
      description: pick(locale, c.descriptionFr, c.descriptionEn),
      startsOn: c.startsOn,
      endsOn: c.endsOn,
      phase,
      inSeason: inSeason(c.startsOn, c.endsOn, today),
      daysLeft: phase === 'during' ? daysLeft(c.endsOn, today) : 0,
      daysUntil: phase === 'before' ? daysUntil(c.startsOn, today) : 0,
      goal: c.goalXaf,
      raised: t.raised,
      percent: percentOf(t.raised, c.goalXaf),
      // Alphabetical, never sorted by progress: encouragement, not a ranking (decision 0041).
      groups: goals
        .map((g) => ({
          name: pick(locale, g.nameFr, g.nameEn ?? ''),
          goal: g.goal,
          raised: t.byGroup.get(g.groupId) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
      cover: cover
        ? {
            variants: cover.variants,
            placeholder: cover.placeholder,
            altFr: cover.altFr,
            altEn: cover.altEn,
            width: cover.width,
            height: cover.height,
            credit: cover.credit,
          }
        : null,
    },
  }
}

async function syncCover(db: Db, campaignId: string, mediaId: string | null) {
  await db
    .delete(mediaUsages)
    .where(and(eq(mediaUsages.entityType, 'campaign'), eq(mediaUsages.entityId, campaignId)))
  if (!mediaId) return
  const [m] = await db
    .select({ id: mediaFiles.id })
    .from(mediaFiles)
    .where(eq(mediaFiles.id, mediaId))
    .limit(1)
  if (m)
    await db
      .insert(mediaUsages)
      .values({ mediaId, entityType: 'campaign', entityId: campaignId, field: 'cover' })
}

const isSuper = async (c: Parameters<typeof audit>[0]) => {
  const a = await c.var.deps.actor()
  return !!a && (a.principal as Principal).isSuperAdmin
}

async function loadCampaign(db: Db, id: string) {
  if (!uuidRe.test(id)) return undefined
  return (await db.select().from(campaigns).where(eq(campaigns.id, id)))[0]
}

export const campaignsApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public/current', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const asked = c.req.query('asOf')
    const asOf = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : undefined
    const today = todayLocal()
    // A date only ever shows validated totals up to that day: harmless, but never cached (the keys would be unbounded).
    if (asOf) {
      const db = await c.var.deps.db()
      c.header('cache-control', 'no-store')
      // The date also stands in for « today »: the season can be replayed (days left, phase) as if it were then.
      return c.json(await publicCurrent(db, locale, asOf, asOf))
    }
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `campaigns/current/${locale}/${today}/v${version}`,
      ttl: 60,
      keep: 60 * 60 * 24 * 3,
      load: (db) => publicCurrent(db, locale, today),
    })
  })
  // For visitors and the menu: is there a campaign to show, and its name and dates. NO amount (decision 0042).
  .get('/public/teaser', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const today = todayLocal()
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `campaigns/teaser/${locale}/${today}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 3,
      load: async (db) => {
        const k = (await publicCurrent(db, locale, today)).campaign
        if (!k) return { campaign: null }
        return {
          campaign: {
            title: k.title,
            startsOn: k.startsOn,
            endsOn: k.endsOn,
            phase: k.phase,
            inSeason: k.inSeason,
            daysUntil: k.daysUntil,
            daysLeft: k.daysLeft,
            cover: k.cover,
          },
        }
      },
    })
  })
  .get('/public/share.svg', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    const today = todayLocal()
    return cachedJson(c, {
      key: `campaigns/share/${locale}/${today}/v${version}`,
      ttl: 300,
      keep: 60 * 60 * 24,
      contentType: 'image/svg+xml; charset=utf-8',
      serialize: (v: { svg: string }) => v.svg,
      load: async (db) => {
        const { campaign: k } = await publicCurrent(db, locale, today)
        const en = locale === 'en'
        const svg = shareCardSvg({
          title: k?.title ?? (en ? 'Harvest festival' : 'Fête des Moissons'),
          raised: k?.raised ?? 0,
          goal: k?.goal ?? 0,
          percent: k?.percent ?? 0,
          line: k
            ? en
              ? `of ${k.goal.toLocaleString('en')} FCFA: together`
              : `sur ${k.goal.toLocaleString('fr')} FCFA : ensemble`
            : '',
          church: en ? 'EEC Nkolndongo 1 parish' : 'Paroisse EEC Nkolndongo 1',
        })
        return { svg }
      },
    })
  })

  // ——— Staff: campaigns ———————————————————————————————————————
  .get('/', requirePermissionAnywhere('campaigns:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db.select().from(campaigns).orderBy(desc(campaigns.startsOn))
    const out = []
    for (const r of rows) {
      const t = await totals(db, r.id)
      out.push({
        ...r,
        raised: t.raised,
        pending: await pendingOf(db, r.id),
        percent: percentOf(t.raised, r.goalXaf),
      })
    }
    return c.json({ items: out })
  })
  .get('/:id', requirePermissionAnywhere('campaigns:read'), async (c) => {
    const db = await c.var.deps.db()
    const r = await loadCampaign(db, c.req.param('id'))
    if (!r) return fail(c, 404, 'not_found')
    const t = await totals(db, r.id)
    const goals = await db
      .select({ groupId: campaignGroupGoals.groupId, goalXaf: campaignGroupGoals.goalXaf })
      .from(campaignGroupGoals)
      .where(eq(campaignGroupGoals.campaignId, r.id))
    return c.json({
      ...r,
      raised: t.raised,
      pending: await pendingOf(db, r.id),
      percent: percentOf(t.raised, r.goalXaf),
      goals: goals.map((g) => ({ ...g, raised: t.byGroup.get(g.groupId) ?? 0 })),
    })
  })
  .post('/', requirePermission('campaigns:edit'), async (c) => {
    const p = campaignBody.safeParse(await c.req.json().catch(() => null))
    if (
      !p.success ||
      !p.data.titleFr ||
      !p.data.startsOn ||
      !p.data.endsOn ||
      p.data.startsOn > p.data.endsOn
    )
      return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const taken = new Set((await db.select({ s: campaigns.slug }).from(campaigns)).map((x) => x.s))
    const [row] = await db
      .insert(campaigns)
      .values({
        slug: uniqueSlug(slugify(p.data.titleFr).slice(0, 60), (s) => taken.has(s)),
        titleFr: p.data.titleFr,
        titleEn: p.data.titleEn ?? '',
        descriptionFr: p.data.descriptionFr ?? '',
        descriptionEn: p.data.descriptionEn ?? '',
        startsOn: p.data.startsOn,
        endsOn: p.data.endsOn,
        goalXaf: p.data.goalXaf ?? 0,
        coverMediaId: p.data.coverMediaId ?? null,
        createdBy: actor?.userId,
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) throw new Error('insert failed')
    await syncCover(db, row.id, row.coverMediaId)
    await audit(c, {
      action: 'create',
      entityType: 'campaign',
      entityId: row.id,
      summaryFr: 'Campagne créée',
      summaryEn: 'Campaign created',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/:id', requirePermission('campaigns:edit'), async (c) => {
    const p = campaignBody.safeParse(await c.req.json().catch(() => null))
    if (!p.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const cur = await loadCampaign(db, c.req.param('id'))
    if (!cur) return fail(c, 404, 'not_found')
    const starts = p.data.startsOn ?? cur.startsOn
    const ends = p.data.endsOn ?? cur.endsOn
    if (starts > ends) return fail(c, 400, 'invalid')
    const actor = await c.var.deps.actor()
    const [row] = await db
      .update(campaigns)
      .set({ ...p.data, updatedBy: actor?.userId, updatedAt: new Date() })
      .where(eq(campaigns.id, cur.id))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    if (p.data.coverMediaId !== undefined) await syncCover(db, row.id, row.coverMediaId)
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'campaign',
      entityId: row.id,
      summaryFr: 'Campagne modifiée',
      summaryEn: 'Campaign edited',
      diff: { fields: Object.keys(p.data) },
    })
    return c.json({ ok: true })
  })
  .delete('/:id', requirePermission('campaigns:delete'), async (c) => {
    const db = await c.var.deps.db()
    const cur = await loadCampaign(db, c.req.param('id'))
    if (!cur) return fail(c, 404, 'not_found')
    await syncCover(db, cur.id, null)
    await db.delete(campaigns).where(eq(campaigns.id, cur.id))
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'campaign',
      entityId: cur.id,
      summaryFr: 'Campagne supprimée',
      summaryEn: 'Campaign deleted',
    })
    return c.json({ ok: true })
  })

  // ——— Staff: group goals (encouragement) ————————————————————————
  .put('/:id/groups/:groupId', requirePermission('campaigns:edit'), async (c) => {
    const p = goalBody.safeParse(await c.req.json().catch(() => null))
    const gid = c.req.param('groupId')
    if (!p.success || !uuidRe.test(gid)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const cur = await loadCampaign(db, c.req.param('id'))
    if (!cur) return fail(c, 404, 'not_found')
    const [g] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, gid))
    if (!g) return fail(c, 404, 'not_found')
    await db
      .insert(campaignGroupGoals)
      .values({ campaignId: cur.id, groupId: gid, goalXaf: p.data.goalXaf })
      .onConflictDoUpdate({
        target: [campaignGroupGoals.campaignId, campaignGroupGoals.groupId],
        set: { goalXaf: p.data.goalXaf },
      })
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })
  .delete('/:id/groups/:groupId', requirePermission('campaigns:edit'), async (c) => {
    const gid = c.req.param('groupId')
    if (!uuidRe.test(gid) || !uuidRe.test(c.req.param('id'))) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    await db
      .delete(campaignGroupGoals)
      .where(
        and(
          eq(campaignGroupGoals.campaignId, c.req.param('id')),
          eq(campaignGroupGoals.groupId, gid),
        ),
      )
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })

  // ——— Staff: the amounts received ————————————————————————————
  .get('/:id/progress', requirePermissionAnywhere('campaigns:read'), async (c) => {
    const db = await c.var.deps.db()
    const cur = await loadCampaign(db, c.req.param('id'))
    if (!cur) return fail(c, 404, 'not_found')
    const rows = await db
      .select({ e: campaignProgress, groupName: groups.nameFr })
      .from(campaignProgress)
      .leftJoin(groups, eq(groups.id, campaignProgress.groupId))
      .where(eq(campaignProgress.campaignId, cur.id))
      .orderBy(desc(campaignProgress.receivedOn), desc(campaignProgress.createdAt))
    const out = []
    // A group-scoped person sees only the entries of the groups they may read.
    for (const r of rows)
      if (await mayOn(c, 'campaigns:read', r.e.groupId))
        out.push({ ...r.e, groupName: r.groupName })
    return c.json({ items: out })
  })
  .post('/:id/progress', requirePermissionAnywhere('campaigns:progress'), async (c) => {
    const p = progressBody.safeParse(await c.req.json().catch(() => null))
    if (
      !p.success ||
      !amountOk(p.data.amountXaf) ||
      !p.data.receivedOn ||
      p.data.receivedOn > todayLocal()
    )
      return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const cur = await loadCampaign(db, c.req.param('id'))
    if (!cur) return fail(c, 404, 'not_found')
    if (!(await mayOn(c, 'campaigns:progress', p.data.groupId ?? null)))
      return fail(c, 403, 'forbidden')
    const actor = await c.var.deps.actor()
    const [row] = await db
      .insert(campaignProgress)
      .values({
        campaignId: cur.id,
        groupId: p.data.groupId ?? null,
        amountXaf: p.data.amountXaf,
        receivedOn: p.data.receivedOn,
        note: p.data.note ?? '',
        createdBy: actor?.userId,
      })
      .returning()
    if (!row) throw new Error('insert failed')
    // The audit line carries no amount and no note.
    await audit(c, {
      action: 'create',
      entityType: 'campaign_progress',
      entityId: row.id,
      summaryFr: 'Somme saisie',
      summaryEn: 'Amount entered',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/progress/:id', requirePermissionAnywhere('campaigns:progress'), async (c) => {
    const p = progressBody.safeParse(await c.req.json().catch(() => null))
    if (!p.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    const cur = uuidRe.test(id)
      ? (await db.select().from(campaignProgress).where(eq(campaignProgress.id, id)))[0]
      : undefined
    if (!cur || !(await mayOn(c, 'campaigns:progress', cur.groupId)))
      return fail(c, 404, 'not_found')
    if (p.data.groupId !== undefined && !(await mayOn(c, 'campaigns:progress', p.data.groupId)))
      return fail(c, 403, 'forbidden')
    if (
      (p.data.amountXaf !== undefined && !amountOk(p.data.amountXaf)) ||
      (p.data.receivedOn && p.data.receivedOn > todayLocal())
    )
      return fail(c, 400, 'invalid')
    // Any change takes the validation away: what was checked is no longer what is written.
    const changed = (['amountXaf', 'receivedOn', 'groupId'] as const).some(
      (k) => p.data[k] !== undefined && p.data[k] !== cur[k],
    )
    await db
      .update(campaignProgress)
      .set({
        ...p.data,
        ...(changed ? { validated: false, validatedBy: null, validatedAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(campaignProgress.id, id))
    if (changed && cur.validated) await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'campaign_progress',
      entityId: id,
      summaryFr: 'Somme modifiée',
      summaryEn: 'Amount edited',
    })
    return c.json({ ok: true, unvalidated: changed && cur.validated })
  })
  .post('/progress/:id/validate', requirePermissionAnywhere('campaigns:validate'), async (c) => {
    const p = z
      .object({ validated: z.boolean() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    const cur = uuidRe.test(id)
      ? (await db.select().from(campaignProgress).where(eq(campaignProgress.id, id)))[0]
      : undefined
    if (!cur || !(await mayOn(c, 'campaigns:validate', cur.groupId)))
      return fail(c, 404, 'not_found')
    const actor = await c.var.deps.actor()
    if (p.data.validated && !mayValidate(actor?.userId ?? '', cur.createdBy, await isSuper(c)))
      return fail(c, 403, 'own_entry')
    await db
      .update(campaignProgress)
      .set(
        p.data.validated
          ? {
              validated: true,
              validatedBy: actor?.userId,
              validatedAt: new Date(),
              updatedAt: new Date(),
            }
          : { validated: false, validatedBy: null, validatedAt: null, updatedAt: new Date() },
      )
      .where(eq(campaignProgress.id, id))
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'campaign_progress',
      entityId: id,
      summaryFr: p.data.validated ? 'Somme validée' : 'Validation retirée',
      summaryEn: p.data.validated ? 'Amount validated' : 'Validation removed',
    })
    return c.json({ ok: true })
  })
  .delete('/progress/:id', requirePermissionAnywhere('campaigns:progress'), async (c) => {
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    const cur = uuidRe.test(id)
      ? (await db.select().from(campaignProgress).where(eq(campaignProgress.id, id)))[0]
      : undefined
    if (!cur || !(await mayOn(c, 'campaigns:progress', cur.groupId)))
      return fail(c, 404, 'not_found')
    await db.delete(campaignProgress).where(eq(campaignProgress.id, id))
    if (cur.validated) await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'campaign_progress',
      entityId: id,
      summaryFr: 'Somme supprimée',
      summaryEn: 'Amount deleted',
    })
    return c.json({ ok: true })
  })
