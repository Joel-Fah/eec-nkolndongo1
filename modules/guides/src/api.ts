/**
 * Guides API, mounted at /api/guides.
 * - Staff: list, edit a guide with its steps (saved as a whole), publish / unpublish, delete.
 * - Public (edge-cached): published guides only, in the visitor's language (French shown when English is missing).
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
import { cleanDoc, plainText, renderHtml, slugify, uniqueSlug } from '@eec/core'
import type { Db } from '@eec/db'
import { and, asc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { guideSteps, guides } from './schema.ts'

const AREA = 'guides'
const text = (n: number) => z.string().max(n)
const doc = z.custom<unknown>((v) => typeof v === 'object' && v !== null)

export const stepBody = z
  .object({
    titleFr: text(160),
    titleEn: text(160),
    bodyFr: doc,
    bodyEn: doc,
    documentsFr: text(800),
    documentsEn: text(800),
    durationFr: text(80),
    durationEn: text(80),
    contactFr: text(160),
    contactEn: text(160),
  })
  .partial()
  .strict()
export const guideBody = z
  .object({
    titleFr: text(160).min(1),
    titleEn: text(160),
    introFr: text(600),
    introEn: text(600),
    audienceFr: text(80),
    audienceEn: text(80),
    icon: z.enum(['checklist', 'couple', 'heart', 'users', 'church', 'book', 'home']),
    sortOrder: z.number().int().min(0).max(999),
    steps: z.array(stepBody).max(30),
  })
  .partial()
  .strict()

type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
const pick = (locale: Locale, fr: string, en: string) => (locale === 'en' && en.trim() ? en : fr)
const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

async function stepsOf(db: Db, guideId: string) {
  return db
    .select()
    .from(guideSteps)
    .where(eq(guideSteps.guideId, guideId))
    .orderBy(asc(guideSteps.sortOrder))
}

async function publicIndex(db: Db, locale: Locale) {
  const rows = await db
    .select()
    .from(guides)
    .where(eq(guides.state, 'published'))
    .orderBy(asc(guides.sortOrder), asc(guides.titleFr))
  const steps = await Promise.all(rows.map((g) => stepsOf(db, g.id)))
  return {
    items: rows.map((g, i) => ({
      slug: g.slug,
      icon: g.icon,
      title: pick(locale, g.titleFr, g.titleEn),
      intro: pick(locale, g.introFr, g.introEn),
      audience: pick(locale, g.audienceFr, g.audienceEn),
      steps: steps[i]?.length ?? 0,
    })),
  }
}

async function publicGuide(db: Db, slug: string, locale: Locale) {
  const [g] = await db
    .select()
    .from(guides)
    .where(and(eq(guides.slug, slug), eq(guides.state, 'published')))
    .limit(1)
  if (!g) return null
  const steps = await stepsOf(db, g.id)
  return {
    slug: g.slug,
    icon: g.icon,
    title: pick(locale, g.titleFr, g.titleEn),
    intro: pick(locale, g.introFr, g.introEn),
    audience: pick(locale, g.audienceFr, g.audienceEn),
    fallback: locale === 'en' && !g.titleEn.trim(),
    steps: steps.map((s, i) => {
      const en = locale === 'en' && plainText(s.bodyEn).trim() !== ''
      return {
        n: i + 1,
        id: s.id,
        title: pick(locale, s.titleFr, s.titleEn),
        html: renderHtml(cleanDoc(en ? s.bodyEn : s.bodyFr)),
        documents: lines(pick(locale, s.documentsFr, s.documentsEn)),
        duration: pick(locale, s.durationFr, s.durationEn),
        contact: pick(locale, s.contactFr, s.contactEn),
      }
    }),
  }
}

const adminDto = (g: typeof guides.$inferSelect, steps: (typeof guideSteps.$inferSelect)[]) => ({
  ...g,
  steps,
})

export const guidesApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `guides/list/${locale}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: (db) => publicIndex(db, locale),
    })
  })
  .get('/public/item/:slug', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const slug = c.req.param('slug')
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `guides/item/${locale}/${slug}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => ({ guide: await publicGuide(db, slug, locale) }),
    })
  })

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermission('guides:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db.select().from(guides).orderBy(asc(guides.sortOrder), asc(guides.titleFr))
    return c.json({ items: rows })
  })
  .get('/:id', requirePermission('guides:read'), async (c) => {
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [g] = await db.select().from(guides).where(eq(guides.id, id)).limit(1)
    if (!g) return fail(c, 404, 'not_found')
    return c.json({ guide: adminDto(g, await stepsOf(db, g.id)) })
  })
  .post('/', requirePermission('guides:edit'), async (c) => {
    const parsed = guideBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !parsed.data.titleFr?.trim()) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const taken = new Set((await db.select({ s: guides.slug }).from(guides)).map((r) => r.s))
    const slug = uniqueSlug(slugify(parsed.data.titleFr), (s) => taken.has(s))
    const [row] = await db
      .insert(guides)
      .values({
        slug,
        titleFr: parsed.data.titleFr,
        titleEn: parsed.data.titleEn ?? '',
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: 'guide',
      entityId: row.id,
      summaryFr: `Parcours « ${row.titleFr} » créé`,
      summaryEn: `Guide “${row.titleFr}” created`,
    })
    return c.json({ guide: adminDto(row, []) })
  })
  .put('/:id', requirePermission('guides:edit'), async (c) => {
    const parsed = guideBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const p = parsed.data
    const [row] = await db
      .update(guides)
      .set({
        ...(p.titleFr !== undefined && { titleFr: p.titleFr }),
        ...(p.titleEn !== undefined && { titleEn: p.titleEn }),
        ...(p.introFr !== undefined && { introFr: p.introFr }),
        ...(p.introEn !== undefined && { introEn: p.introEn }),
        ...(p.audienceFr !== undefined && { audienceFr: p.audienceFr }),
        ...(p.audienceEn !== undefined && { audienceEn: p.audienceEn }),
        ...(p.icon !== undefined && { icon: p.icon }),
        ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
        updatedBy: actor?.userId,
        updatedAt: new Date(),
      })
      .where(eq(guides.id, id))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    if (p.steps) {
      await db.delete(guideSteps).where(eq(guideSteps.guideId, id))
      if (p.steps.length)
        await db.insert(guideSteps).values(
          p.steps.map((s, i) => ({
            guideId: id,
            sortOrder: i,
            titleFr: s.titleFr ?? '',
            titleEn: s.titleEn ?? '',
            bodyFr: cleanDoc(s.bodyFr ?? { type: 'doc', content: [] }),
            bodyEn: cleanDoc(s.bodyEn ?? { type: 'doc', content: [] }),
            documentsFr: s.documentsFr ?? '',
            documentsEn: s.documentsEn ?? '',
            durationFr: s.durationFr ?? '',
            durationEn: s.durationEn ?? '',
            contactFr: s.contactFr ?? '',
            contactEn: s.contactEn ?? '',
          })),
        )
    }
    await audit(c, {
      action: 'update',
      entityType: 'guide',
      entityId: id,
      summaryFr: `Parcours « ${row.titleFr} » modifié`,
      summaryEn: `Guide “${row.titleFr}” edited`,
    })
    if (row.state === 'published') await bumpContentVersion(db, AREA)
    return c.json({ guide: adminDto(row, await stepsOf(db, id)) })
  })
  .post('/:id/publish', requirePermission('guides:publish'), (c) => setState(c, 'published'))
  .post('/:id/unpublish', requirePermission('guides:publish'), (c) => setState(c, 'draft'))
  .delete('/:id', requirePermission('guides:delete'), async (c) => {
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db
      .delete(guides)
      .where(and(eq(guides.id, id), ne(guides.state, 'published')))
      .returning()
    if (!row) return fail(c, 409, 'unpublish_first')
    await audit(c, {
      action: 'delete',
      entityType: 'guide',
      entityId: id,
      summaryFr: `Parcours « ${row.titleFr} » supprimé`,
      summaryEn: `Guide “${row.titleFr}” deleted`,
    })
    return c.json({ ok: true })
  })

async function setState(c: import('hono').Context<AppEnv>, state: 'published' | 'draft') {
  const id = c.req.param('id') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 404, 'not_found')
  const db = await c.var.deps.db()
  const [g] = await db.select().from(guides).where(eq(guides.id, id)).limit(1)
  if (!g) return fail(c, 404, 'not_found')
  if (state === 'published') {
    const steps = await stepsOf(db, id)
    // A guide needs a title and at least one step with a title before it can go public.
    if (!g.titleFr.trim() || steps.length === 0 || steps.some((s) => !s.titleFr.trim()))
      return fail(c, 400, 'invalid')
  }
  await db.update(guides).set({ state, updatedAt: new Date() }).where(eq(guides.id, id))
  await audit(c, {
    action: state === 'published' ? 'publish' : 'unpublish',
    entityType: 'guide',
    entityId: id,
    summaryFr:
      state === 'published'
        ? `Parcours « ${g.titleFr} » publié`
        : `Parcours « ${g.titleFr} » retiré du site`,
    summaryEn:
      state === 'published'
        ? `Guide “${g.titleFr}” published`
        : `Guide “${g.titleFr}” taken off the site`,
  })
  await bumpContentVersion(db, AREA)
  return c.json({ ok: true, state })
}
