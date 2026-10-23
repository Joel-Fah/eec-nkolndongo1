/**
 * Bulletin API, mounted at /api/bulletin.
 * - Staff: list, compose (new, or copied from last week), edit, publish / take off, delete.
 * - Public (edge-cached): the latest bulletin, one by week, and the archive. French first; English where it was written.
 * The admin assembles a draft from the site's own public data (this Sunday, the week's agenda, the meditations, the news), so
 * no module reads another's tables; staff edit everything before publishing.
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
import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { BLOCK_KINDS, type BulletinBlock, bulletins } from './schema.ts'

const AREA = 'bulletin'
type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const isSunday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay() === 0

export function cleanUrl(input: string): string | null {
  if (input.trim() === '') return ''
  try {
    const u = new URL(input.trim())
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password)
      return null
    return u.toString().length <= 500 ? u.toString() : null
  } catch {
    return null
  }
}

const item = z
  .object({
    titleFr: z.string().trim().max(160),
    titleEn: z.string().trim().max(160),
    textFr: z.string().trim().max(800),
    textEn: z.string().trim().max(800),
    key: z.string().max(200).optional(),
  })
  .strict()
const block = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{4,40}$/),
    kind: z.enum(BLOCK_KINDS),
    titleFr: z.string().trim().max(120),
    titleEn: z.string().trim().max(120),
    items: z.array(item).max(40),
  })
  .strict()

export const patchBody = z
  .object({
    titleFr: z.string().trim().max(160),
    titleEn: z.string().trim().max(160),
    blocks: z.array(block).max(12),
    pdfUrl: z
      .string()
      .max(500)
      .refine((u) => cleanUrl(u) !== null),
  })
  .partial()
  .strict()
export const createBody = z
  .object({
    weekOf: day.refine(isSunday, 'sunday'),
    blocks: z.array(block).max(12).optional(),
    copyFrom: day.optional(),
    titleFr: z.string().trim().max(160).optional(),
    titleEn: z.string().trim().max(160).optional(),
  })
  .strict()

type Row = typeof bulletins.$inferSelect

function publicDto(r: Row, locale: Locale) {
  const en = locale === 'en'
  return {
    weekOf: r.weekOf,
    title: (en && r.titleEn) || r.titleFr,
    pdfUrl: r.pdfUrl,
    publishedAt: r.publishedAt,
    blocks: r.blocks
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        title: (en && b.titleEn) || b.titleFr,
        // English where it was written, French otherwise (a line is never left out for lack of a translation).
        items: b.items
          .map((i) => ({
            title: (en && i.titleEn) || i.titleFr,
            text: (en && i.textEn) || i.textFr,
            fallback: en && !(i.titleEn || i.textEn),
          }))
          .filter((i) => i.title || i.text),
      }))
      .filter((b) => b.items.length > 0),
  }
}

const newId = () => Math.random().toString(36).slice(2, 10)

export const bulletinApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public/latest', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `bulletin/latest/${locale}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const [row] = await db
          .select()
          .from(bulletins)
          .where(eq(bulletins.state, 'published'))
          .orderBy(desc(bulletins.weekOf))
          .limit(1)
        return { bulletin: row ? publicDto(row, locale) : null }
      },
    })
  })
  .get('/public/item/:week', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const week = c.req.param('week')
    if (!day.safeParse(week).success) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `bulletin/item/${locale}/${week}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const [row] = await db
          .select()
          .from(bulletins)
          .where(and(eq(bulletins.weekOf, week), eq(bulletins.state, 'published')))
        return { bulletin: row ? publicDto(row, locale) : null }
      },
    })
  })
  .get('/public/archive', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `bulletin/archive/${locale}/v${version}`,
      ttl: 300,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const rows = await db
          .select()
          .from(bulletins)
          .where(eq(bulletins.state, 'published'))
          .orderBy(desc(bulletins.weekOf))
          .limit(120)
        return {
          items: rows.map((r) => ({
            weekOf: r.weekOf,
            title: (locale === 'en' && r.titleEn) || r.titleFr,
          })),
        }
      },
    })
  })

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermission('bulletin:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db.select().from(bulletins).orderBy(desc(bulletins.weekOf)).limit(200)
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        weekOf: r.weekOf,
        state: r.state,
        titleFr: r.titleFr,
        blocks: r.blocks.length,
        updatedAt: r.updatedAt,
      })),
    })
  })
  .get('/:id', requirePermission('bulletin:read'), async (c) => {
    const db = await c.var.deps.db()
    const [row] = await db
      .select()
      .from(bulletins)
      .where(eq(bulletins.id, c.req.param('id')))
    if (!row) return fail(c, 404, 'not_found')
    return c.json(row)
  })
  .post('/', requirePermission('bulletin:edit'), async (c) => {
    const body = createBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [exists] = await db
      .select({ id: bulletins.id })
      .from(bulletins)
      .where(eq(bulletins.weekOf, body.data.weekOf))
    if (exists) return c.json({ error: { code: 'exists' }, id: exists.id }, 409)
    let blocks: BulletinBlock[] = body.data.blocks ?? []
    if (body.data.copyFrom) {
      const [prev] = await db
        .select()
        .from(bulletins)
        .where(eq(bulletins.weekOf, body.data.copyFrom))
      if (prev) blocks = prev.blocks.map((b) => ({ ...b, id: newId() }))
    }
    const [row] = await db
      .insert(bulletins)
      .values({
        weekOf: body.data.weekOf,
        titleFr: body.data.titleFr ?? '',
        titleEn: body.data.titleEn ?? '',
        blocks,
        createdBy: actor?.userId,
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: 'bulletin',
      entityId: row.id,
      summaryFr: 'Bulletin créé',
      summaryEn: 'Bulletin created',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/:id', requirePermission('bulletin:edit'), async (c) => {
    const parsed = patchBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const set = {
      ...parsed.data,
      ...(parsed.data.pdfUrl !== undefined && { pdfUrl: cleanUrl(parsed.data.pdfUrl) ?? '' }),
      updatedBy: actor?.userId,
      updatedAt: new Date(),
    }
    const [row] = await db
      .update(bulletins)
      .set(set)
      .where(eq(bulletins.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    if (row.state === 'published') await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'bulletin',
      entityId: row.id,
      summaryFr: 'Bulletin modifié',
      summaryEn: 'Bulletin edited',
      diff: { fields: Object.keys(parsed.data) },
    })
    return c.json({ ok: true, updatedAt: row.updatedAt })
  })
  .post('/:id/:state{publish|unpublish}', requirePermission('bulletin:publish'), async (c) => {
    const to = c.req.param('state') === 'publish' ? 'published' : 'draft'
    const db = await c.var.deps.db()
    const [row] = await db
      .update(bulletins)
      .set({
        state: to,
        publishedAt: to === 'published' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(bulletins.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'bulletin',
      entityId: row.id,
      summaryFr: to === 'published' ? 'Bulletin publié' : 'Bulletin retiré du site',
      summaryEn: to === 'published' ? 'Bulletin published' : 'Bulletin taken off the site',
    })
    return c.json({ ok: true })
  })
  .delete('/:id', requirePermission('bulletin:delete'), async (c) => {
    const db = await c.var.deps.db()
    const res = await db
      .delete(bulletins)
      .where(eq(bulletins.id, c.req.param('id')))
      .returning({ id: bulletins.id })
    if (!res.length) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'bulletin',
      entityId: c.req.param('id'),
      summaryFr: 'Bulletin supprimé',
      summaryEn: 'Bulletin deleted',
    })
    return c.json({ ok: true })
  })
