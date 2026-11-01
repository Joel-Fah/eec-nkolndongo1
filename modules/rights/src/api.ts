/**
 * Data-rights log API, mounted at /api/rights (decision 0052): who asked, what, received on, the deadline, what was done. Staff only.
 * Members keep their own tools in Mon espace (a copy of their data, deletion). Audited without the person's details.
 */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { CHANNELS, DEADLINE_DAYS, KINDS, STATUSES } from './index.ts'
import { rightsRequests as rr } from './schema.ts'

const uuid = /^[0-9a-f-]{36}$/
const day = z.iso.date()
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
export const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export const createBody = z
  .object({
    kind: z.enum(KINDS),
    name: z.string().trim().min(2).max(120),
    contact: z.string().trim().max(120).default(''),
    channel: z.enum(CHANNELS),
    receivedOn: day.optional(),
  })
  .strict()
export const patchBody = z
  .object({ status: z.enum(STATUSES), outcome: z.string().trim().max(400).default('') })
  .partial()
  .strict()

/** Where a request stands today: open past its date is « overdue », open within five days is « soon ». */
export function urgency(r: { status: string; dueOn: string }, now = today()) {
  if (r.status === 'done' || r.status === 'refused') return 'closed' as const
  if (r.dueOn < now) return 'overdue' as const
  return r.dueOn <= addDays(now, 5) ? ('soon' as const) : ('open' as const)
}

export const rightsApi = new Hono<AppEnv>()
  .get('/', requirePermission('rights:read'), async (c) => {
    const status = c.req.query('status')
    const db = await c.var.deps.db()
    const open = ['received', 'in_progress'] as const
    const rows = await db
      .select()
      .from(rr)
      .where(
        status === 'closed'
          ? inArray(rr.status, ['done', 'refused'])
          : status === 'open'
            ? inArray(rr.status, [...open])
            : undefined,
      )
      .orderBy(asc(rr.dueOn), desc(rr.createdAt))
      .limit(300)
    return c.json({
      deadlineDays: DEADLINE_DAYS,
      items: rows.map((r) => ({ ...r, urgency: urgency(r) })),
    })
  })

  .post('/', requirePermission('rights:handle'), async (c) => {
    const body = createBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const received = body.data.receivedOn ?? today()
    const [row] = await db
      .insert(rr)
      .values({
        kind: body.data.kind,
        name: body.data.name,
        contact: body.data.contact,
        channel: body.data.channel,
        receivedOn: received,
        dueOn: addDays(received, DEADLINE_DAYS),
        handledBy: actor?.userId ?? null,
      })
      .returning({ id: rr.id })
    if (!row) return fail(c, 400, 'invalid')
    // The log of the log: that a request was noted and of what kind, never who.
    await audit(c, {
      action: 'rights.create',
      entityType: 'rights_request',
      entityId: row.id,
      summaryFr: `Demande « ${body.data.kind} » notée`,
      summaryEn: `Request “${body.data.kind}” logged`,
    })
    return c.json({ id: row.id }, 201)
  })

  .patch('/:id', requirePermission('rights:handle'), async (c) => {
    const id = c.req.param('id')
    const body = patchBody.safeParse(await c.req.json().catch(() => null))
    if (!uuid.test(id) || !body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [before] = await db.select().from(rr).where(eq(rr.id, id))
    if (!before) return fail(c, 404, 'not_found')
    const status = body.data.status ?? before.status
    const closing = status === 'done' || status === 'refused'
    // A request is closed with a word on what was done.
    const outcome = body.data.outcome ?? before.outcome
    if (closing && outcome.trim().length < 3) return fail(c, 400, 'outcome_required')
    await db
      .update(rr)
      .set({
        status,
        outcome,
        closedOn: closing ? (before.closedOn ?? today()) : null,
        handledBy: actor?.userId ?? before.handledBy,
      })
      .where(eq(rr.id, id))
    await audit(c, {
      action: 'rights.update',
      entityType: 'rights_request',
      entityId: id,
      summaryFr: `Demande passée à « ${status} »`,
      summaryEn: `Request set to “${status}”`,
    })
    return c.json({ ok: true })
  })

  .delete('/:id', requirePermission('rights:delete'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const gone = await db
      .delete(rr)
      .where(and(eq(rr.id, id)))
      .returning({ id: rr.id })
    if (!gone.length) return fail(c, 404, 'not_found')
    await audit(c, {
      action: 'rights.delete',
      entityType: 'rights_request',
      entityId: id,
      summaryFr: 'Demande supprimée du registre',
      summaryEn: 'Request deleted from the log',
    })
    return c.json({ ok: true })
  })
