/**
 * Contact API, mounted at /api/contact.
 * - Public: POST /submit — honeypot, minimum fill time, rate limit per hashed address, length limits, explicit consent.
 * - Staff: the inbox (prayer requests only with contact:read-sensitive), status, assignment, internal notes, counts.
 */
import { type AppEnv, audit, clientIp, fail, publicRoute, requirePermission } from '@eec/api-kit'
import { allow, can, type Principal } from '@eec/auth'
import { user } from '@eec/db/schema'
import { and, count, desc, eq, gte, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { contactMessages, contactNotes } from './schema.ts'

export const CATEGORIES = [
  'renseignement',
  'vie_pratique',
  'departements',
  'priere',
  'autre',
] as const
const MIN_FILL_MS = 4000
const MAX_FILL_MS = 6 * 60 * 60 * 1000

export const submitBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.union([z.literal(''), z.email().max(120)]).default(''),
    phone: z.string().trim().max(40).default(''),
    category: z.enum(CATEGORIES),
    subject: z.string().trim().max(120).default(''),
    message: z.string().trim().min(10).max(2000),
    consent: z.literal(true),
    /** Honeypot: hidden from people; bots fill it. */
    website: z.string().max(200).default(''),
    /** When the form was shown (ms since epoch), for the minimum fill time. */
    openedAt: z.number().int(),
  })
  .strict()
  .refine((b) => b.email !== '' || b.phone !== '', { path: ['email'], message: 'email_or_phone' })

export const patchBody = z
  .object({ status: z.enum(['new', 'progress', 'handled']), assign: z.enum(['me', 'none']) })
  .partial()
  .strict()
export const noteBody = z.object({ body: z.string().trim().min(1).max(1000) }).strict()

const uuid = /^[0-9a-f-]{36}$/

async function addressKey(secret: string, ip: string) {
  const data = new TextEncoder().encode(`${secret}:contact:${ip}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const mayReadSensitive = async (c: Parameters<typeof audit>[0]) => {
  const actor = await c.var.deps.actor()
  return !!actor && can(actor.principal as Principal, 'contact:read-sensitive')
}

export const contactApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .post(
    '/submit',
    publicRoute(
      'The contact form: honeypot, minimum fill time, rate limit, consent required, no third party',
    ),
    async (c) => {
      const parsed = submitBody.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) return fail(c, 400, 'invalid')
      const b = parsed.data
      // A filled honeypot is a bot: say « ok » and keep nothing, so it learns nothing.
      if (b.website.trim() !== '') return c.json({ ok: true })
      const age = Date.now() - b.openedAt
      if (age < MIN_FILL_MS || age > MAX_FILL_MS) return fail(c, 400, 'too_fast')
      const db = await c.var.deps.db()
      const key = await addressKey(c.env.AUTH_SECRET, clientIp(c) ?? 'unknown')
      if (!(await allow(db, `contact:${key}`, 5, 3600))) return fail(c, 429, 'rate_limited')
      await db.insert(contactMessages).values({
        name: b.name,
        email: b.email,
        phone: b.phone,
        category: b.category,
        subject: b.subject,
        message: b.message,
        sensitive: b.category === 'priere',
        consentAt: new Date(),
      })
      return c.json({ ok: true })
    },
  )

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermission('contact:read'), async (c) => {
    const db = await c.var.deps.db()
    const sensitive = await mayReadSensitive(c)
    const status = c.req.query('status')
    // A date window (YYYY-MM-DD, both ends included), in UTC.
    const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
    const from = day(c.req.query('from'))
    const to = day(c.req.query('to'))
    const rows = await db
      .select({ m: contactMessages, assignee: user.name })
      .from(contactMessages)
      .leftJoin(user, eq(user.id, contactMessages.assignedTo))
      .where(
        and(
          sensitive ? undefined : eq(contactMessages.sensitive, false),
          status && ['new', 'progress', 'handled'].includes(status)
            ? eq(contactMessages.status, status)
            : undefined,
        ),
      )
      .orderBy(desc(contactMessages.createdAt))
      .limit(200)
    return c.json({
      items: rows.map((r) => ({
        id: r.m.id,
        name: r.m.name,
        category: r.m.category,
        status: r.m.status,
        sensitive: r.m.sensitive,
        assignee: r.assignee,
        createdAt: r.m.createdAt,
        preview: r.m.message.slice(0, 140),
      })),
    })
  })
  .get('/counts', requirePermission('contact:read'), async (c) => {
    const db = await c.var.deps.db()
    const sensitive = await mayReadSensitive(c)
    const [row] = await db
      .select({ n: count() })
      .from(contactMessages)
      .where(
        and(
          eq(contactMessages.status, 'new'),
          sensitive ? undefined : eq(contactMessages.sensitive, false),
        ),
      )
    return c.json({ new: row?.n ?? 0 })
  })
  .get('/:id', requirePermission('contact:read'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [m] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1)
    if (!m || (m.sensitive && !(await mayReadSensitive(c)))) return fail(c, 404, 'not_found')
    const notes = await db
      .select({ n: contactNotes, author: user.name })
      .from(contactNotes)
      .leftJoin(user, eq(user.id, contactNotes.authorId))
      .where(eq(contactNotes.messageId, id))
      .orderBy(contactNotes.createdAt)
    const [assignee] = m.assignedTo
      ? await db.select({ name: user.name }).from(user).where(eq(user.id, m.assignedTo))
      : []
    return c.json({
      message: m,
      assignee: assignee?.name ?? null,
      notes: notes.map((x) => ({
        id: x.n.id,
        body: x.n.body,
        author: x.author,
        createdAt: x.n.createdAt,
      })),
    })
  })
  .patch('/:id', requirePermission('contact:handle'), async (c) => {
    const id = c.req.param('id')
    const parsed = patchBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [m] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1)
    if (!m || (m.sensitive && !(await mayReadSensitive(c)))) return fail(c, 404, 'not_found')
    const actor = await c.var.deps.actor()
    const p = parsed.data
    await db
      .update(contactMessages)
      .set({
        ...(p.status !== undefined && {
          status: p.status,
          handledAt: p.status === 'handled' ? new Date() : null,
        }),
        ...(p.assign === 'me' && {
          assignedTo: actor?.userId,
          ...(m.status === 'new' && p.status === undefined && { status: 'progress' }),
        }),
        ...(p.assign === 'none' && { assignedTo: null }),
        updatedAt: new Date(),
      })
      .where(eq(contactMessages.id, id))
    // The audit line never carries the message or the sender: only what happened to it.
    await audit(c, {
      action: 'update',
      entityType: 'contact_message',
      entityId: id,
      summaryFr: p.status ? `Message marqué « ${p.status} »` : 'Message pris en charge ou libéré',
      summaryEn: p.status ? `Message marked “${p.status}”` : 'Message taken or released',
    })
    return c.json({ ok: true })
  })
  .post('/:id/notes', requirePermission('contact:handle'), async (c) => {
    const id = c.req.param('id')
    const parsed = noteBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [m] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1)
    if (!m || (m.sensitive && !(await mayReadSensitive(c)))) return fail(c, 404, 'not_found')
    const actor = await c.var.deps.actor()
    await db
      .insert(contactNotes)
      .values({ messageId: id, authorId: actor?.userId, body: parsed.data.body })
    return c.json({ ok: true })
  })
  .delete('/:id', requirePermission('contact:delete'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 404, 'not_found')
    const db = await c.var.deps.db()
    const [m] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1)
    if (!m || (m.sensitive && !(await mayReadSensitive(c)))) return fail(c, 404, 'not_found')
    await db.delete(contactMessages).where(eq(contactMessages.id, id))
    await audit(c, {
      action: 'delete',
      entityType: 'contact_message',
      entityId: id,
      summaryFr: 'Message supprimé',
      summaryEn: 'Message deleted',
    })
    return c.json({ ok: true })
  })

// Kept for the retention job and tests: the inbox statuses that count as « open ».
export const OPEN_STATUSES = ['new', 'progress'] as const
