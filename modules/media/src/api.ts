/**
 * Media API, mounted at /api/media by the registry.
 * Photos are resized in the browser; only the variants come here (multipart), are checked by their first
 * bytes and size, and are stored. Audio and PDF are streamed straight to the store as they are.
 * Every change is audited; a file used somewhere (media_usages) cannot be deleted.
 */
import {
  type AppEnv,
  audit,
  bumpContentVersion,
  cachedJson,
  contentVersion,
  fail,
  requirePermission,
} from '@eec/api-kit'
import { and, desc, eq, ilike, notExists, or, sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { z } from 'zod'
import { LIMITS, type MediaKind, mediaKey, sniff } from './rules.ts'
import { type MediaVariant, mediaFiles, mediaUsages } from './schema.ts'
import { createStore } from './store.ts'

const QUOTA = 5 * 1024 * 1024 * 1024 // Neon Object Storage, Free plan
const text = (max: number) => z.string().trim().max(max).optional()
const meta = z.object({
  originalName: z.string().trim().min(1).max(200),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  placeholder: z.string().max(400).optional(),
  altFr: z.string().trim().min(1).max(300),
  altEn: text(300),
  captionFr: text(500),
  captionEn: text(500),
  credit: text(200),
  creditUrl: z.url().max(400).optional(),
})
const patch = z.object({
  altFr: text(300),
  altEn: text(300),
  captionFr: text(500),
  captionEn: text(500),
  credit: text(200),
  creditUrl: z.union([z.url().max(400), z.literal('')]).optional(),
})

type Row = typeof mediaFiles.$inferSelect
const dto = (r: Row) => ({
  id: r.id,
  kind: r.kind as MediaKind,
  mime: r.mime,
  originalName: r.originalName,
  sizeBytes: r.sizeBytes,
  width: r.width,
  height: r.height,
  variants: r.variants,
  placeholder: r.placeholder,
  altFr: r.altFr,
  altEn: r.altEn,
  captionFr: r.captionFr,
  captionEn: r.captionEn,
  credit: r.credit,
  creditUrl: r.creditUrl,
  source: r.source,
  status: r.status,
  createdAt: r.createdAt,
})

/** Looks at the first `n` bytes without disturbing the body: one branch of a tee is read, then dropped. */
async function peek(body: ReadableStream<Uint8Array>, n: number) {
  const [look, stream] = body.tee()
  const reader = look.getReader()
  const chunks: Uint8Array[] = []
  let have = 0
  while (have < n) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    have += value.length
  }
  await reader.cancel().catch(() => {})
  const head = new Uint8Array(have)
  let at = 0
  for (const ch of chunks) {
    head.set(ch, at)
    at += ch.length
  }
  return { head, stream }
}

/** Photo credits for the public page: one entry per photographer (never a file, never anything private). */
async function creditsOf(db: Awaited<ReturnType<AppEnv['Variables']['deps']['db']>>) {
  const rows = await db
    .select({
      credit: mediaFiles.credit,
      creditUrl: sql<string | null>`max(${mediaFiles.creditUrl})`,
      source: sql<string>`max(${mediaFiles.source})`,
      photos: sql<number>`count(*)::int`,
    })
    .from(mediaFiles)
    .where(
      and(
        eq(mediaFiles.status, 'ready'),
        eq(mediaFiles.kind, 'image'),
        sql`coalesce(${mediaFiles.credit}, '') <> ''`,
      ),
    )
    .groupBy(mediaFiles.credit)
    .orderBy(mediaFiles.credit)
  return { credits: rows }
}

export const mediaApi = new Hono<AppEnv>()
  // Anonymous and edge-cached: the names behind the photos (footer « Photos : Pexels » → credits page).
  .get('/credits', async (c) => {
    const db = await c.var.deps.db().catch(() => null)
    const version = db ? await contentVersion(db, 'media').catch(() => 0) : 0
    return cachedJson(c, {
      key: `media/credits/v${version}`,
      ttl: 300,
      keep: 60 * 60 * 24 * 7,
      load: async () => {
        if (!db) throw new Error('database unavailable')
        return creditsOf(db)
      },
    })
  })
  .get('/', requirePermission('media:read'), async (c) => {
    const db = await c.var.deps.db()
    const q = c.req.query()
    const where = [
      eq(mediaFiles.status, q.status === 'archived' ? 'archived' : 'ready'),
      ...(q.kind && ['image', 'audio', 'document'].includes(q.kind)
        ? [eq(mediaFiles.kind, q.kind)]
        : []),
      ...(q.source ? [eq(mediaFiles.source, q.source)] : []),
      ...(q.q
        ? [
            or(
              ilike(mediaFiles.originalName, `%${q.q}%`),
              ilike(mediaFiles.altFr, `%${q.q}%`),
              ilike(mediaFiles.altEn, `%${q.q}%`),
            ),
          ]
        : []),
      ...(q.unused === '1'
        ? [
            notExists(
              db
                .select({ x: sql`1` })
                .from(mediaUsages)
                .where(eq(mediaUsages.mediaId, mediaFiles.id)),
            ),
          ]
        : []),
    ]
    const limit = Math.min(Number(q.limit) || 60, 120)
    const rows = await db
      .select()
      .from(mediaFiles)
      .where(and(...where))
      .orderBy(desc(mediaFiles.createdAt))
      .limit(limit)
      .offset(Math.max(0, Number(q.offset) || 0))
    return c.json({ items: rows.map(dto) })
  })

  // Storage used, for the meter (the Free plan holds 5 GB; the admin warns from 70 %).
  .get('/stats', requirePermission('media:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select({
        kind: mediaFiles.kind,
        bytes: sql<number>`coalesce(sum(${mediaFiles.sizeBytes}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(mediaFiles)
      .groupBy(mediaFiles.kind)
    const used = rows.reduce((n, r) => n + Number(r.bytes), 0)
    const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    const before = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))
    const [month] = await db
      .select({
        now: sql<number>`count(*) filter (where ${mediaFiles.createdAt} >= ${start})::int`,
        last: sql<number>`count(*) filter (where ${mediaFiles.createdAt} >= ${before} and ${mediaFiles.createdAt} < ${start})::int`,
      })
      .from(mediaFiles)
    const [todo] = await db
      .select({
        noAltEn: sql<number>`count(*) filter (where ${mediaFiles.kind} = 'image' and coalesce(${mediaFiles.altEn}, '') = '')::int`,
        unused: sql<number>`count(*) filter (where not exists (select 1 from ${mediaUsages} u where u.media_id = ${mediaFiles.id}))::int`,
      })
      .from(mediaFiles)
      .where(eq(mediaFiles.status, 'ready'))
    return c.json({
      withoutAltEn: todo?.noAltEn ?? 0,
      unused: todo?.unused ?? 0,
      files: rows.reduce((n, r) => n + r.count, 0),
      filesThisMonth: month?.now ?? 0,
      filesLastMonth: month?.last ?? 0,
      usedBytes: used,
      quotaBytes: QUOTA,
      byKind: rows.map((r) => ({ kind: r.kind, bytes: Number(r.bytes), count: r.count })),
      limits: LIMITS,
    })
  })

  .get('/:id', requirePermission('media:read'), async (c) => {
    const db = await c.var.deps.db()
    const [row] = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, c.req.param('id')))
      .limit(1)
    if (!row) return fail(c, 404, 'not_found')
    const usages = await db.select().from(mediaUsages).where(eq(mediaUsages.mediaId, row.id))
    return c.json({
      ...dto(row),
      usages: usages.map((u) => ({
        entityType: u.entityType,
        entityId: u.entityId,
        field: u.field,
      })),
    })
  })

  // Photos: variants (w480, w960, …) already resized, stripped of metadata and encoded in the browser.
  .post('/image', requirePermission('media:upload'), async (c) => {
    const form = await c.req.formData().catch(() => null)
    if (!form) return fail(c, 400, 'invalid')
    const parsed = meta.safeParse(safeJson(form.get('meta')))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const files: { width: number; file: File }[] = []
    for (const [name, value] of form.entries()) {
      const m = /^w(\d{2,5})$/.exec(name)
      if (m && typeof value !== 'string') files.push({ width: Number(m[1]), file: value })
    }
    if (!files.length || files.length > 6) return fail(c, 400, 'invalid')
    files.sort((a, b) => a.width - b.width)

    const id = crypto.randomUUID()
    const store = createStore(c.env)
    const variants: MediaVariant[] = []
    try {
      for (const { width, file } of files) {
        if (file.size > LIMITS.imageVariant) return fail(c, 400, 'too_large')
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
        const type = sniff(head)
        if (type?.kind !== 'image') return fail(c, 400, 'bad_type')
        const key = mediaKey('image', id, `w${width}`, type.ext)
        await store.put(key, await file.arrayBuffer(), type.mime)
        variants.push({ key, width, size: file.size, mime: type.mime })
      }
    } catch (error) {
      await Promise.all(variants.map((v) => store.delete(v.key).catch(() => {})))
      throw error
    }
    const actor = await c.var.deps.actor()
    const db = await c.var.deps.db()
    const m = parsed.data
    const [row] = await db
      .insert(mediaFiles)
      .values({
        id,
        kind: 'image',
        mime: variants[0]?.mime ?? 'image/webp',
        originalName: m.originalName,
        sizeBytes: variants.reduce((n, v) => n + v.size, 0),
        width: m.width,
        height: m.height,
        variants,
        placeholder: m.placeholder ?? null,
        altFr: m.altFr,
        altEn: m.altEn || null,
        captionFr: m.captionFr || null,
        captionEn: m.captionEn || null,
        credit: m.credit || null,
        creditUrl: m.creditUrl || null,
        createdBy: actor?.userId ?? null,
      })
      .returning()
    await audit(c, {
      action: 'create',
      entityType: 'media',
      entityId: id,
      summaryFr: `Photo ajoutée : « ${m.originalName} »`,
      summaryEn: `Photo added: “${m.originalName}”`,
    })
    await bumpContentVersion(db, 'media')
    return c.json(dto(row as Row), 201)
  })

  // Audio and PDF: streamed to the store as they are (nothing is held in memory).
  .post('/file', requirePermission('media:upload'), async (c) => {
    const name = (c.req.query('name') ?? '').trim().slice(0, 200)
    const length = Number(c.req.header('content-length'))
    if (!name || !Number.isFinite(length) || length < 12 || !c.req.raw.body)
      return fail(c, 400, 'invalid')
    const { head, stream } = await peek(c.req.raw.body, 16)
    const type = sniff(head)
    if (!type || type.kind === 'image') return fail(c, 400, 'bad_type')
    if (length > (type.kind === 'audio' ? LIMITS.audio : LIMITS.document))
      return fail(c, 400, 'too_large')

    const id = crypto.randomUUID()
    const key = mediaKey(type.kind, id, 'file', type.ext)
    const store = createStore(c.env)
    await store.put(key, stream, type.mime, length)
    const actor = await c.var.deps.actor()
    const db = await c.var.deps.db()
    const [row] = await db
      .insert(mediaFiles)
      .values({
        id,
        kind: type.kind,
        mime: type.mime,
        originalName: name,
        sizeBytes: length,
        variants: [{ key, width: 0, size: length, mime: type.mime }],
        createdBy: actor?.userId ?? null,
      })
      .returning()
    await audit(c, {
      action: 'create',
      entityType: 'media',
      entityId: id,
      summaryFr: `${type.kind === 'audio' ? 'Audio' : 'Document'} ajouté : « ${name} »`,
      summaryEn: `${type.kind === 'audio' ? 'Audio' : 'Document'} added: “${name}”`,
    })
    await bumpContentVersion(db, 'media')
    return c.json(dto(row as Row), 201)
  })

  .patch('/:id', requirePermission('media:edit'), async (c) => {
    const parsed = patch.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    const [before] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1)
    if (!before) return fail(c, 404, 'not_found')
    const p = parsed.data
    // An image always keeps a French description (accessibility).
    if (before.kind === 'image' && p.altFr !== undefined && !p.altFr)
      return fail(c, 400, 'alt_required')
    const set: Partial<Row> = {}
    for (const k of ['altFr', 'altEn', 'captionFr', 'captionEn', 'credit', 'creditUrl'] as const)
      if (p[k] !== undefined) set[k] = p[k] || null
    await db.update(mediaFiles).set(set).where(eq(mediaFiles.id, id))
    await audit(c, {
      action: 'update',
      entityType: 'media',
      entityId: id,
      summaryFr: `Description modifiée : « ${before.originalName} »`,
      summaryEn: `Description edited: “${before.originalName}”`,
      diff: Object.keys(set),
    })
    await bumpContentVersion(db, 'media')
    return c.json({ ok: true })
  })

  .post('/:id/archive', requirePermission('media:edit'), (c) => setStatus(c, 'archived'))
  .post('/:id/restore', requirePermission('media:edit'), (c) => setStatus(c, 'ready'))

  .delete('/:id', requirePermission('media:delete'), async (c) => {
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    const [row] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1)
    if (!row) return fail(c, 404, 'not_found')
    const [used] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(mediaUsages)
      .where(eq(mediaUsages.mediaId, id))
    if (used && used.n > 0) return fail(c, 409, 'in_use')
    const store = createStore(c.env)
    await Promise.all(row.variants.map((v) => store.delete(v.key)))
    await db.delete(mediaFiles).where(eq(mediaFiles.id, id))
    await audit(c, {
      action: 'delete',
      entityType: 'media',
      entityId: id,
      summaryFr: `Fichier supprimé : « ${row.originalName} »`,
      summaryEn: `File deleted: “${row.originalName}”`,
    })
    await bumpContentVersion(db, 'media')
    return c.json({ ok: true })
  })

async function setStatus(c: Context<AppEnv>, status: 'ready' | 'archived') {
  const db = await c.var.deps.db()
  const id = c.req.param('id') as string
  const [row] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1)
  if (!row) return fail(c, 404, 'not_found')
  await db.update(mediaFiles).set({ status }).where(eq(mediaFiles.id, id))
  await audit(c, {
    action: 'update',
    entityType: 'media',
    entityId: id,
    summaryFr: `${status === 'archived' ? 'Fichier archivé' : 'Fichier restauré'} : « ${row.originalName} »`,
    summaryEn: `${status === 'archived' ? 'File archived' : 'File restored'}: “${row.originalName}”`,
  })
  await bumpContentVersion(db, 'media')
  return c.json({ ok: true })
}

const safeJson = (v: unknown) => {
  try {
    return typeof v === 'string' ? JSON.parse(v) : null
  } catch {
    return null
  }
}
