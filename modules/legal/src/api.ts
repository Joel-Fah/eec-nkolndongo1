/**
 * Legal API, mounted at /api/legal.
 * - Staff: versions per document; a new version starts as a draft (a copy of the latest), is edited, then published
 *   with a plain-words summary of what changed. A published version is never edited.
 * - Public (edge-cached): the latest published version of each document, plus the Pexels photographers for the credits.
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
import { cleanDoc, isEmptyDoc, plainText, renderHtml } from '@eec/core'
import type { Db } from '@eec/db'
import { mediaFiles } from '@eec/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { legalDocuments } from './schema.ts'

const AREA = 'legal'
export const DOC_KEYS = ['privacy', 'mentions', 'credits'] as const
type DocKey = (typeof DOC_KEYS)[number]
const doc = z.custom<unknown>((v) => typeof v === 'object' && v !== null)
const uuid = /^[0-9a-f-]{36}$/

export const draftBody = z.object({ bodyFr: doc, bodyEn: doc }).partial().strict()
export const publishBody = z
  .object({
    summaryFr: z.string().trim().max(600).default(''),
    summaryEn: z.string().trim().max(600).default(''),
    purposeChanged: z.boolean().default(false),
  })
  .strict()

type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
const isKey = (k: string): k is DocKey => (DOC_KEYS as readonly string[]).includes(k)

async function latestPublished(db: Db, key: DocKey) {
  const [row] = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.docKey, key), eq(legalDocuments.state, 'published')))
    .orderBy(desc(legalDocuments.version))
    .limit(1)
  return row ?? null
}

async function publicData(db: Db, locale: Locale) {
  const out: Record<string, unknown> = {}
  for (const key of DOC_KEYS) {
    const d = await latestPublished(db, key)
    const en = locale === 'en' && !isEmptyDoc(d?.bodyEn as never)
    out[key] = d
      ? {
          label: d.label,
          version: d.version,
          publishedAt: d.publishedAt,
          summary: (locale === 'en' && d.summaryEn) || d.summaryFr,
          fallback: locale === 'en' && !en,
          html: renderHtml(cleanDoc(en ? d.bodyEn : d.bodyFr)),
        }
      : null
  }
  // The photographers of the stand-in photos (Pexels), from the media library: names only.
  const rows = await db
    .selectDistinct({ credit: mediaFiles.credit })
    .from(mediaFiles)
    .where(
      and(
        eq(mediaFiles.source, 'pexels'),
        sql`${mediaFiles.credit} is not null and ${mediaFiles.credit} <> ''`,
      ),
    )
  out.pexels = rows
    .map((r) => r.credit)
    .filter((x): x is string => !!x)
    .sort()
  return out
}

export const legalApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `legal/public/${locale}/v${version}`,
      ttl: 300,
      keep: 60 * 60 * 24 * 7,
      load: (db) => publicData(db, locale),
    })
  })

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermission('legal:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select({
        id: legalDocuments.id,
        docKey: legalDocuments.docKey,
        version: legalDocuments.version,
        label: legalDocuments.label,
        state: legalDocuments.state,
        purposeChanged: legalDocuments.purposeChanged,
        summaryFr: legalDocuments.summaryFr,
        publishedAt: legalDocuments.publishedAt,
        updatedAt: legalDocuments.updatedAt,
      })
      .from(legalDocuments)
      .orderBy(desc(legalDocuments.version))
    return c.json({ items: rows })
  })
  .get('/versions/:id', requirePermission('legal:read'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).limit(1)
    return row ? c.json({ version: row }) : fail(c, 404, 'not_found')
  })
  .post('/:key/versions', requirePermission('legal:update'), async (c) => {
    const key = c.req.param('key')
    if (!isKey(key)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const all = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.docKey, key))
      .orderBy(desc(legalDocuments.version))
    const open = all.find((d) => d.state === 'draft')
    if (open) return c.json({ version: open }) // one draft at a time
    const last = all[0]
    const n = (last?.version ?? 0) + 1
    const actor = await c.var.deps.actor()
    const month = new Date().toISOString().slice(0, 7)
    const [row] = await db
      .insert(legalDocuments)
      .values({
        docKey: key,
        version: n,
        label: `${month}-v${n}`,
        bodyFr: last?.bodyFr ?? { type: 'doc', content: [] },
        bodyEn: last?.bodyEn ?? { type: 'doc', content: [] },
        createdBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: 'legal_document',
      entityId: row.id,
      summaryFr: `Nouvelle version (brouillon) du document « ${key} »`,
      summaryEn: `New draft version of the “${key}” document`,
    })
    return c.json({ version: row })
  })
  .put('/versions/:id', requirePermission('legal:update'), async (c) => {
    const id = c.req.param('id')
    const parsed = draftBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).limit(1)
    if (!row) return fail(c, 404, 'not_found')
    if (row.state !== 'draft') return fail(c, 409, 'published') // a published version is never edited
    const p = parsed.data
    await db
      .update(legalDocuments)
      .set({
        ...(p.bodyFr !== undefined && { bodyFr: cleanDoc(p.bodyFr) }),
        ...(p.bodyEn !== undefined && { bodyEn: cleanDoc(p.bodyEn) }),
        updatedAt: new Date(),
      })
      .where(eq(legalDocuments.id, id))
    return c.json({ ok: true })
  })
  .post('/versions/:id/publish', requirePermission('legal:publish'), async (c) => {
    const id = c.req.param('id')
    const parsed = publishBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).limit(1)
    if (!row) return fail(c, 404, 'not_found')
    if (row.state !== 'draft') return fail(c, 409, 'published')
    if (!plainText(row.bodyFr).trim()) return fail(c, 400, 'invalid')
    // A new privacy policy tells members what changed, so a summary is required.
    if (row.docKey === 'privacy' && row.version > 1 && !parsed.data.summaryFr)
      return fail(c, 400, 'summary_required')
    const actor = await c.var.deps.actor()
    await db
      .update(legalDocuments)
      .set({
        state: 'published',
        summaryFr: parsed.data.summaryFr,
        summaryEn: parsed.data.summaryEn,
        purposeChanged: row.docKey === 'privacy' ? parsed.data.purposeChanged : false,
        publishedAt: new Date(),
        publishedBy: actor?.userId,
        updatedAt: new Date(),
      })
      .where(eq(legalDocuments.id, id))
    await audit(c, {
      action: 'publish',
      entityType: 'legal_document',
      entityId: id,
      summaryFr: `Version ${row.label} du document « ${row.docKey} » publiée${parsed.data.purposeChanged ? ' (finalité modifiée)' : ''}`,
      summaryEn: `Version ${row.label} of the “${row.docKey}” document published${parsed.data.purposeChanged ? ' (purpose changed)' : ''}`,
    })
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })
  .delete('/versions/:id', requirePermission('legal:update'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [row] = await db
      .delete(legalDocuments)
      .where(and(eq(legalDocuments.id, id), eq(legalDocuments.state, 'draft')))
      .returning()
    return row ? c.json({ ok: true }) : fail(c, 409, 'published')
  })
