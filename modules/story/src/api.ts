/**
 * Story API, mounted at /api/story.
 * - Staff: edit the content slots of the story pages, the history milestones, and the council (with consent).
 * - Public (edge-cached): published slots and milestones; council names only with a recorded consent.
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
import { COUNCIL_ROLES, cleanDoc, PAGE_SLOTS, plainText, renderHtml } from '@eec/core'
import type { Db } from '@eec/db'
import { mediaFiles, mediaUsages } from '@eec/db/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { councilMembers, historyMilestones, pageSlots } from './schema.ts'

const AREA = 'story'
const text = (n: number) => z.string().max(n)
const doc = z.custom<unknown>((v) => typeof v === 'object' && v !== null)
const uuid = /^[0-9a-f-]{36}$/
const ROLE_KEYS = COUNCIL_ROLES.map((r) => r.key) as [string, ...string[]]

export const slotBody = z
  .object({ valueFr: text(2000), valueEn: text(2000), bodyFr: doc, bodyEn: doc })
  .partial()
  .strict()
/** How a step's pictures sit: auto picks one by the number of pictures. */
export const MILESTONE_LAYOUTS = ['auto', 'fan', 'stack', 'bento', 'row'] as const
export const milestoneBody = z
  .object({
    year: text(40),
    titleFr: text(120),
    titleEn: text(120),
    textFr: text(800),
    textEn: text(800),
    mediaId: z.string().uuid().nullable(),
    extraMediaIds: z.array(z.string().uuid()).max(5),
    layout: z.enum(MILESTONE_LAYOUTS),
    sortOrder: z.number().int().min(0).max(999),
  })
  .partial()
  .strict()
export const councilBody = z
  .object({
    name: text(120).min(1),
    roleKey: z.enum(ROLE_KEYS),
    titleFr: text(120),
    titleEn: text(120),
    photoMediaId: z.string().uuid().nullable(),
    publicConsent: z.boolean(),
    term: text(60),
    sortOrder: z.number().int().min(0).max(999),
  })
  .partial()
  .strict()

type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
const pick = (locale: Locale, fr: string, en: string) => (locale === 'en' && en.trim() ? en : fr)
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

async function mediaMap(db: Db, ids: (string | null)[]) {
  const wanted = ids.filter((x): x is string => !!x)
  const rows = wanted.length
    ? await db.select().from(mediaFiles).where(inArray(mediaFiles.id, wanted))
    : []
  return (id: string | null) => mediaOut(rows.find((m) => m.id === id))
}

async function publicData(db: Db, locale: Locale) {
  const slotRows = await db.select().from(pageSlots).where(eq(pageSlots.state, 'published'))
  const slots: Record<string, Record<string, { text: string; html: string }>> = {}
  for (const r of slotRows) {
    const def = PAGE_SLOTS[r.pageKey]?.slots.find((s) => s.key === r.slotKey)
    if (!def) continue
    const en = locale === 'en'
    const value = pick(locale, r.valueFr, r.valueEn)
    const body = en && plainText(r.bodyEn).trim() ? r.bodyEn : r.bodyFr
    const out =
      def.type === 'rich'
        ? { text: plainText(body), html: renderHtml(cleanDoc(body)) }
        : def.type === 'number'
          ? { text: /^\d{1,6}$/.test(r.valueFr.trim()) ? r.valueFr.trim() : '', html: '' }
          : { text: value, html: '' }
    if (!out.text.trim()) continue
    const forPage = slots[r.pageKey] ?? {}
    forPage[r.slotKey] = out
    slots[r.pageKey] = forPage
  }
  const ms = await db
    .select()
    .from(historyMilestones)
    .where(eq(historyMilestones.state, 'published'))
    .orderBy(asc(historyMilestones.sortOrder), asc(historyMilestones.year))
  const members = await db
    .select()
    .from(councilMembers)
    .orderBy(asc(councilMembers.sortOrder), asc(councilMembers.name))
  const media = await mediaMap(db, [
    ...ms.flatMap((m) => [m.mediaId, ...m.extraMediaIds]),
    ...members.filter((m) => m.publicConsent).map((m) => m.photoMediaId),
  ])
  return {
    slots,
    milestones: ms.map((m) => ({
      id: m.id,
      year: m.year,
      title: pick(locale, m.titleFr, m.titleEn),
      text: pick(locale, m.textFr, m.textEn),
      image: media(m.mediaId),
      images: [m.mediaId, ...m.extraMediaIds].map((x) => media(x)).filter((x) => x !== null),
      layout: m.layout,
    })),
    // Names and photos only with consent; without it, the card carries the role alone.
    council: COUNCIL_ROLES.map((r) => ({
      key: r.key,
      label: locale === 'en' ? r.en : r.fr,
      people: members
        .filter((m) => m.roleKey === r.key)
        .map((m) => ({
          name: m.publicConsent ? m.name : null,
          title: pick(locale, m.titleFr, m.titleEn),
          term: m.publicConsent ? m.term : '',
          photo: m.publicConsent ? media(m.photoMediaId) : null,
        })),
    })).filter((g) => g.people.length > 0),
  }
}

async function syncUsage(
  db: Db,
  entityType: string,
  entityId: string,
  mediaIds: (string | null)[] | string | null,
  field: string,
) {
  const ids = (Array.isArray(mediaIds) ? mediaIds : [mediaIds]).filter((x): x is string => !!x)
  await db
    .delete(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId),
        eq(mediaUsages.field, field),
      ),
    )
  for (const mediaId of ids) {
    const [m] = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mediaId))
      .limit(1)
    if (m) await db.insert(mediaUsages).values({ mediaId, entityType, entityId, field })
  }
}

const mayPublish = async (c: Parameters<typeof audit>[0]) => {
  const actor = await c.var.deps.actor()
  return !!actor && can(actor.principal as Principal, 'story:publish')
}

export const storyApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `story/public/${locale}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: (db) => publicData(db, locale),
    })
  })

  // ——— Staff: slots ——————————————————————————————————————————
  .get('/slots', requirePermission('story:read'), async (c) => {
    const db = await c.var.deps.db()
    return c.json({ slots: await db.select().from(pageSlots) })
  })
  .put('/slots/:page/:key', requirePermission('story:edit'), async (c) => {
    const { page, key } = c.req.param()
    const def = PAGE_SLOTS[page ?? '']?.slots.find((s) => s.key === key)
    if (!def) return fail(c, 404, 'not_found')
    const parsed = slotBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const p = parsed.data
    if (
      def.type === 'text' &&
      ((p.valueFr?.length ?? 0) > def.max || (p.valueEn?.length ?? 0) > def.max)
    )
      return fail(c, 400, 'invalid')
    // A figure is digits only, the same in both languages.
    if (def.type === 'number') {
      const n = (p.valueFr ?? '').trim()
      if (n !== '' && !/^\d{1,6}$/.test(n)) return fail(c, 400, 'invalid')
      p.valueFr = n
      p.valueEn = n
    }
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const publisher = await mayPublish(c)
    const set = {
      ...(p.valueFr !== undefined && { valueFr: p.valueFr }),
      ...(p.valueEn !== undefined && { valueEn: p.valueEn }),
      ...(p.bodyFr !== undefined && { bodyFr: cleanDoc(p.bodyFr) }),
      ...(p.bodyEn !== undefined && { bodyEn: cleanDoc(p.bodyEn) }),
      // An edit by someone who cannot publish takes the text back off the site until it is published again.
      ...(!publisher && { state: 'draft' }),
      updatedBy: actor?.userId,
      updatedAt: new Date(),
    }
    const [row] = await db
      .insert(pageSlots)
      .values({ pageKey: page as string, slotKey: key as string, ...set })
      .onConflictDoUpdate({ target: [pageSlots.pageKey, pageSlots.slotKey], set })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'update',
      entityType: 'page_slot',
      entityId: row.id,
      summaryFr: `Texte « ${def.label.fr} » (${PAGE_SLOTS[page as string]?.label.fr}) modifié`,
      summaryEn: `Text “${def.label.en}” (${PAGE_SLOTS[page as string]?.label.en}) edited`,
    })
    await bumpContentVersion(db, AREA)
    return c.json({ slot: row })
  })
  .post('/slots/:page/:key/publish', requirePermission('story:publish'), (c) =>
    slotState(c, 'published'),
  )
  .post('/slots/:page/:key/unpublish', requirePermission('story:publish'), (c) =>
    slotState(c, 'draft'),
  )

  // ——— Staff: history ————————————————————————————————————————
  .get('/milestones', requirePermission('story:read'), async (c) => {
    const db = await c.var.deps.db()
    return c.json({
      items: await db
        .select()
        .from(historyMilestones)
        .orderBy(asc(historyMilestones.sortOrder), asc(historyMilestones.year)),
    })
  })
  .post('/milestones', requirePermission('story:edit'), async (c) => {
    const parsed = milestoneBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const p = parsed.data
    const [row] = await db
      .insert(historyMilestones)
      .values({
        year: p.year ?? '',
        titleFr: p.titleFr ?? '',
        titleEn: p.titleEn ?? '',
        textFr: p.textFr ?? '',
        textEn: p.textEn ?? '',
        mediaId: p.mediaId ?? null,
        extraMediaIds: p.extraMediaIds ?? [],
        layout: p.layout ?? 'auto',
        sortOrder: p.sortOrder ?? 0,
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await syncUsage(db, 'history_milestone', row.id, [row.mediaId, ...row.extraMediaIds], 'image')
    await audit(c, {
      action: 'create',
      entityType: 'history_milestone',
      entityId: row.id,
      summaryFr: 'Étape de l’histoire ajoutée',
      summaryEn: 'History milestone added',
    })
    return c.json({ item: row })
  })
  .put('/milestones/:id', requirePermission('story:edit'), async (c) => {
    const id = c.req.param('id')
    const parsed = milestoneBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const p = parsed.data
    const [row] = await db
      .update(historyMilestones)
      .set({
        ...(p.year !== undefined && { year: p.year }),
        ...(p.titleFr !== undefined && { titleFr: p.titleFr }),
        ...(p.titleEn !== undefined && { titleEn: p.titleEn }),
        ...(p.textFr !== undefined && { textFr: p.textFr }),
        ...(p.textEn !== undefined && { textEn: p.textEn }),
        ...(p.mediaId !== undefined && { mediaId: p.mediaId }),
        ...(p.extraMediaIds !== undefined && { extraMediaIds: p.extraMediaIds }),
        ...(p.layout !== undefined && { layout: p.layout }),
        ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
        ...(!(await mayPublish(c)) && { state: 'draft' }),
        updatedBy: actor?.userId,
        updatedAt: new Date(),
      })
      .where(eq(historyMilestones.id, id))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await syncUsage(db, 'history_milestone', row.id, [row.mediaId, ...row.extraMediaIds], 'image')
    await audit(c, {
      action: 'update',
      entityType: 'history_milestone',
      entityId: id,
      summaryFr: 'Étape de l’histoire modifiée',
      summaryEn: 'History milestone edited',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ item: row })
  })
  .post('/milestones/:id/publish', requirePermission('story:publish'), (c) =>
    milestoneState(c, 'published'),
  )
  .post('/milestones/:id/unpublish', requirePermission('story:publish'), (c) =>
    milestoneState(c, 'draft'),
  )
  .delete('/milestones/:id', requirePermission('story:edit'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db.delete(historyMilestones).where(eq(historyMilestones.id, id)).returning()
    if (!row) return fail(c, 404, 'not_found')
    await syncUsage(db, 'history_milestone', id, null, 'image')
    await audit(c, {
      action: 'delete',
      entityType: 'history_milestone',
      entityId: id,
      summaryFr: 'Étape de l’histoire supprimée',
      summaryEn: 'History milestone deleted',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })

  // ——— Staff: council ————————————————————————————————————————
  .get('/council', requirePermission('story:council'), async (c) => {
    const db = await c.var.deps.db()
    return c.json({
      items: await db
        .select()
        .from(councilMembers)
        .orderBy(
          asc(councilMembers.roleKey),
          asc(councilMembers.sortOrder),
          asc(councilMembers.name),
        ),
    })
  })
  .post('/council', requirePermission('story:council'), async (c) => {
    const parsed = councilBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !parsed.data.name || !parsed.data.roleKey) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const p = parsed.data
    const [row] = await db
      .insert(councilMembers)
      .values({
        name: p.name as string,
        roleKey: p.roleKey as string,
        titleFr: p.titleFr ?? '',
        titleEn: p.titleEn ?? '',
        photoMediaId: p.photoMediaId ?? null,
        publicConsent: p.publicConsent ?? false,
        consentBy: p.publicConsent ? actor?.userId : null,
        consentAt: p.publicConsent ? new Date() : null,
        term: p.term ?? '',
        sortOrder: p.sortOrder ?? 0,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await syncUsage(db, 'council_member', row.id, row.photoMediaId, 'photo')
    await audit(c, {
      action: 'create',
      entityType: 'council_member',
      entityId: row.id,
      summaryFr: row.publicConsent
        ? 'Membre du conseil ajouté (nom public, consentement enregistré)'
        : 'Membre du conseil ajouté (rôle seulement)',
      summaryEn: row.publicConsent
        ? 'Council member added (name public, consent recorded)'
        : 'Council member added (role only)',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ item: row })
  })
  .put('/council/:id', requirePermission('story:council'), async (c) => {
    const id = c.req.param('id')
    const parsed = councilBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [old] = await db.select().from(councilMembers).where(eq(councilMembers.id, id)).limit(1)
    if (!old) return fail(c, 404, 'not_found')
    const actor = await c.var.deps.actor()
    const p = parsed.data
    const changed = p.publicConsent !== undefined && p.publicConsent !== old.publicConsent
    const consent = !changed
      ? {}
      : p.publicConsent
        ? { publicConsent: true, consentBy: actor?.userId, consentAt: new Date() }
        : { publicConsent: false, consentBy: null, consentAt: null }
    const [row] = await db
      .update(councilMembers)
      .set({
        ...(p.name !== undefined && { name: p.name }),
        ...(p.roleKey !== undefined && { roleKey: p.roleKey }),
        ...(p.titleFr !== undefined && { titleFr: p.titleFr }),
        ...(p.titleEn !== undefined && { titleEn: p.titleEn }),
        ...(p.photoMediaId !== undefined && { photoMediaId: p.photoMediaId }),
        ...(p.term !== undefined && { term: p.term }),
        ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
        ...consent,
        updatedAt: new Date(),
      })
      .where(eq(councilMembers.id, id))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await syncUsage(db, 'council_member', id, row.photoMediaId, 'photo')
    await audit(c, {
      action: 'update',
      entityType: 'council_member',
      entityId: id,
      summaryFr: changed
        ? row.publicConsent
          ? 'Consentement de publication du nom enregistré'
          : 'Consentement de publication du nom retiré'
        : 'Membre du conseil modifié',
      summaryEn: changed
        ? row.publicConsent
          ? 'Consent to publish the name recorded'
          : 'Consent to publish the name withdrawn'
        : 'Council member edited',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ item: row })
  })
  .delete('/council/:id', requirePermission('story:council'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db.delete(councilMembers).where(eq(councilMembers.id, id)).returning()
    if (!row) return fail(c, 404, 'not_found')
    await syncUsage(db, 'council_member', id, null, 'photo')
    await audit(c, {
      action: 'delete',
      entityType: 'council_member',
      entityId: id,
      summaryFr: 'Membre du conseil retiré',
      summaryEn: 'Council member removed',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })

async function slotState(c: import('hono').Context<AppEnv>, state: 'published' | 'draft') {
  const page = c.req.param('page') ?? ''
  const key = c.req.param('key') ?? ''
  const def = PAGE_SLOTS[page]?.slots.find((s) => s.key === key)
  if (!def) return fail(c, 404, 'not_found')
  const db = await c.var.deps.db()
  const [row] = await db
    .select()
    .from(pageSlots)
    .where(and(eq(pageSlots.pageKey, page), eq(pageSlots.slotKey, key)))
    .limit(1)
  if (!row) return fail(c, 400, 'invalid')
  if (state === 'published' && !(def.type === 'rich' ? plainText(row.bodyFr) : row.valueFr).trim())
    return fail(c, 400, 'invalid') // nothing to publish
  await db.update(pageSlots).set({ state, updatedAt: new Date() }).where(eq(pageSlots.id, row.id))
  await audit(c, {
    action: state === 'published' ? 'publish' : 'unpublish',
    entityType: 'page_slot',
    entityId: row.id,
    summaryFr:
      state === 'published'
        ? `Texte « ${def.label.fr} » publié`
        : `Texte « ${def.label.fr} » retiré du site`,
    summaryEn:
      state === 'published'
        ? `Text “${def.label.en}” published`
        : `Text “${def.label.en}” taken off the site`,
  })
  await bumpContentVersion(db, AREA)
  return c.json({ ok: true, state })
}

async function milestoneState(c: import('hono').Context<AppEnv>, state: 'published' | 'draft') {
  const id = c.req.param('id') ?? ''
  if (!uuid.test(id)) return fail(c, 404, 'not_found')
  const db = await c.var.deps.db()
  const [row] = await db
    .select()
    .from(historyMilestones)
    .where(eq(historyMilestones.id, id))
    .limit(1)
  if (!row) return fail(c, 404, 'not_found')
  if (state === 'published' && (!row.titleFr.trim() || !row.year.trim()))
    return fail(c, 400, 'invalid')
  await db
    .update(historyMilestones)
    .set({ state, updatedAt: new Date() })
    .where(eq(historyMilestones.id, id))
  await audit(c, {
    action: state === 'published' ? 'publish' : 'unpublish',
    entityType: 'history_milestone',
    entityId: id,
    summaryFr:
      state === 'published' ? 'Étape de l’histoire publiée' : 'Étape de l’histoire retirée du site',
    summaryEn:
      state === 'published'
        ? 'History milestone published'
        : 'History milestone taken off the site',
  })
  await bumpContentVersion(db, AREA)
  return c.json({ ok: true, state })
}
