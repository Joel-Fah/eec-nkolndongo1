/**
 * Schedule API, mounted at /api/schedule.
 * - Staff list, edit and (with schedule:validate) approve slots; exceptions (cancelled / changed / extra gathering).
 *   Editing an approved slot takes its approval away unless the editor may approve it themselves.
 * - Public (edge-cached): approved slots, exceptions for the next weeks, the next service, and .ics per slot.
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
import {
  buildIcs,
  nextService,
  PARISH_TZ,
  SLOT_KINDS,
  type Slot,
  type SlotException,
  slotProblems,
  upcomingServices,
  zonedToUtc,
} from '@eec/core'
import type { Db } from '@eec/db'
import { and, asc, eq, gte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { scheduleExceptions, scheduleSlots } from './schema.ts'

const AREA = 'schedule'
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const text = (n: number) => z.string().max(n)

const slotBody = z
  .object({
    kind: z.enum(SLOT_KINDS),
    labelFr: text(120).min(1),
    labelEn: text(120),
    weekday: z.number().int().min(0).max(6),
    startTime: time,
    endTime: time.nullable(),
    placeFr: text(160),
    placeEn: text(160),
    groupId: z.string().uuid().nullable(),
    notesFr: text(300),
    notesEn: text(300),
    sortOrder: z.number().int().min(0).max(999),
  })
  .partial()
  .strict()

const excBody = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slotId: z.string().uuid().nullable(),
    kind: z.enum(['cancelled', 'changed', 'extra']),
    noteFr: text(200).default(''),
    noteEn: text(200).default(''),
    startTime: time.nullable().default(null),
    endTime: time.nullable().default(null),
    labelFr: text(120).default(''),
    labelEn: text(120).default(''),
  })
  .strict()
  .refine((e) => e.kind !== 'changed' || e.startTime, 'start_required')
  .refine((e) => e.kind !== 'extra' || (e.startTime && e.labelFr), 'extra_incomplete')

type SlotRow = typeof scheduleSlots.$inferSelect
type ExcRow = typeof scheduleExceptions.$inferSelect
type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')

const toSlot = (r: SlotRow): Slot => ({
  id: r.id,
  kind: r.kind as Slot['kind'],
  labelFr: r.labelFr,
  labelEn: r.labelEn || r.labelFr,
  weekday: r.weekday,
  start: r.startTime,
  end: r.endTime,
  placeFr: r.placeFr,
  placeEn: r.placeEn || r.placeFr,
})
const toExc = (r: ExcRow): SlotException => ({
  id: r.id,
  date: r.date,
  slotId: r.slotId,
  kind: r.kind as SlotException['kind'],
  noteFr: r.noteFr,
  noteEn: r.noteEn || r.noteFr,
  start: r.startTime ?? undefined,
  end: r.endTime,
  labelFr: r.labelFr,
  labelEn: r.labelEn || r.labelFr,
})

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: PARISH_TZ }).format(new Date())

async function publicData(db: Db) {
  const slots = (
    await db
      .select()
      .from(scheduleSlots)
      .where(eq(scheduleSlots.validated, true))
      .orderBy(
        asc(scheduleSlots.weekday),
        asc(scheduleSlots.startTime),
        asc(scheduleSlots.sortOrder),
      )
  ).map(toSlot)
  const ids = new Set(slots.map((s) => s.id))
  const exc = (
    await db.select().from(scheduleExceptions).where(gte(scheduleExceptions.date, today()))
  )
    .map(toExc)
    .filter((e) => e.slotId === null || ids.has(e.slotId))
  return { slots, exceptions: exc }
}

export const scheduleApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `schedule/public/${today()}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => publicData(db),
    })
  })
  .get('/public/next', async (c) => {
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `schedule/next/${new Date().toISOString().slice(0, 13)}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => {
        const { slots, exceptions } = await publicData(db)
        const next = nextService(slots, exceptions, new Date())
        return {
          next: next && {
            id: next.slot.id,
            kind: next.slot.kind,
            labelFr: next.slot.labelFr,
            labelEn: next.slot.labelEn,
            startsAt: next.startsAt.toISOString(),
            endsAt: next.endsAt?.toISOString() ?? null,
            when: next.when,
            changed: next.changed,
            noteFr: next.noteFr ?? '',
            noteEn: next.noteEn ?? '',
          },
        }
      },
    })
  })
  .get('/public/slot/:id/slot.ics', async (c) => {
    const id = c.req.param('id')
    const locale = localeOf(c.req.query('locale'))
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `schedule/ics/${locale}/${id}/v${version}`,
      ttl: 600,
      keep: 60 * 60 * 24 * 7,
      contentType: 'text/calendar; charset=utf-8',
      load: async (db) => {
        const [row] = await db
          .select()
          .from(scheduleSlots)
          .where(and(eq(scheduleSlots.id, id), eq(scheduleSlots.validated, true)))
          .limit(1)
        return row ? toSlot(row) : null
      },
      serialize: (slot) => {
        if (!slot) return buildIcs({ name: 'Horaires', events: [] })
        const d = today()
        const [y, m, day] = d.split('-').map(Number) as [number, number, number]
        // The first occurrence on or after today, repeating weekly.
        const wd = new Date(`${d}T00:00:00Z`).getUTCDay()
        const first = new Date(Date.UTC(y, m - 1, day + ((slot.weekday - wd + 7) % 7)))
        const [sh, sm] = slot.start.split(':').map(Number) as [number, number]
        const starts = zonedToUtc(
          first.getUTCFullYear(),
          first.getUTCMonth() + 1,
          first.getUTCDate(),
          sh,
          sm,
          PARISH_TZ,
        )
        const ends = slot.end
          ? (([eh, em]) =>
              zonedToUtc(
                first.getUTCFullYear(),
                first.getUTCMonth() + 1,
                first.getUTCDate(),
                eh,
                em,
                PARISH_TZ,
              ))(slot.end.split(':').map(Number) as [number, number])
          : null
        return buildIcs({
          name: locale === 'fr' ? slot.labelFr : slot.labelEn,
          events: [
            {
              id: `slot-${slot.id}`,
              title: locale === 'fr' ? slot.labelFr : slot.labelEn,
              startsAt: starts,
              endsAt: ends,
              allDay: false,
              timezone: PARISH_TZ,
              recurrence: { freq: 'weekly', byDay: [slot.weekday as 0] },
              exceptions: [],
              location: (locale === 'fr' ? slot.placeFr : slot.placeEn) || undefined,
            },
          ],
        })
      },
    })
  })

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermission('schedule:read'), async (c) => {
    const db = await c.var.deps.db()
    const slots = await db
      .select()
      .from(scheduleSlots)
      .orderBy(asc(scheduleSlots.weekday), asc(scheduleSlots.startTime))
    const exceptions = await db
      .select()
      .from(scheduleExceptions)
      .where(gte(scheduleExceptions.date, today()))
      .orderBy(asc(scheduleExceptions.date))
    return c.json({ slots, exceptions })
  })
  .post('/slots', requirePermission('schedule:update'), async (c) => {
    const parsed = slotBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const p = parsed.data
    const { labelFr, startTime, weekday } = p
    if (!labelFr || !startTime || weekday === undefined) return fail(c, 400, 'invalid')
    if (slotProblems({ weekday, start: startTime, end: p.endTime ?? null }).length)
      return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [row] = await db
      .insert(scheduleSlots)
      .values({
        kind: p.kind ?? 'culte',
        labelFr,
        labelEn: p.labelEn ?? '',
        weekday,
        startTime,
        endTime: p.endTime ?? null,
        placeFr: p.placeFr ?? '',
        placeEn: p.placeEn ?? '',
        groupId: p.groupId ?? null,
        notesFr: p.notesFr ?? '',
        notesEn: p.notesEn ?? '',
        sortOrder: p.sortOrder ?? 0,
        validated: false,
        createdBy: actor?.userId,
      })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'create',
      entityType: 'schedule_slot',
      entityId: row.id,
      summaryFr: `Horaire ajouté : ${row.labelFr}`,
      summaryEn: `Time added: ${row.labelFr}`,
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/slots/:id', requirePermission('schedule:update'), async (c) => {
    const parsed = slotBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [row] = await db
      .select()
      .from(scheduleSlots)
      .where(eq(scheduleSlots.id, c.req.param('id')))
      .limit(1)
    if (!row) return fail(c, 404, 'not_found')
    const p = parsed.data
    const next = {
      weekday: p.weekday ?? row.weekday,
      start: p.startTime ?? row.startTime,
      end: p.endTime === undefined ? row.endTime : p.endTime,
    }
    if (slotProblems(next).length) return fail(c, 400, 'invalid')
    const actor = await c.var.deps.actor()
    const mayValidate = can(actor?.principal as Principal, 'schedule:validate')
    // A change takes the approval away, unless the editor may approve (then it stays approved).
    const set: Partial<typeof scheduleSlots.$inferInsert> = {
      ...p,
      ...(p.startTime ? { startTime: p.startTime } : {}),
    }
    delete (set as Record<string, unknown>).startTime
    if (p.startTime) set.startTime = p.startTime
    if (row.validated && !mayValidate)
      Object.assign(set, { validated: false, validatedBy: null, validatedAt: null })
    await db.update(scheduleSlots).set(set).where(eq(scheduleSlots.id, row.id))
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'schedule_slot',
      entityId: row.id,
      summaryFr: `Horaire modifié : ${row.labelFr}`,
      summaryEn: `Time edited: ${row.labelFr}`,
      diff: { fields: Object.keys(p) },
    })
    return c.json({ ok: true, validated: row.validated && mayValidate })
  })
  .post('/slots/:id/validate', requirePermission('schedule:validate'), async (c) => {
    const body = z
      .object({ validated: z.boolean() })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [row] = await db
      .update(scheduleSlots)
      .set(
        body.data.validated
          ? { validated: true, validatedBy: actor?.userId, validatedAt: new Date() }
          : { validated: false, validatedBy: null, validatedAt: null },
      )
      .where(eq(scheduleSlots.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'schedule_slot',
      entityId: row.id,
      summaryFr: `Horaire ${body.data.validated ? 'approuvé' : 'retiré du site'} : ${row.labelFr}`,
      summaryEn: `Time ${body.data.validated ? 'approved' : 'taken off the site'}: ${row.labelFr}`,
    })
    return c.json({ ok: true })
  })
  .delete('/slots/:id', requirePermission('schedule:update'), async (c) => {
    const db = await c.var.deps.db()
    const [row] = await db
      .delete(scheduleSlots)
      .where(eq(scheduleSlots.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'schedule_slot',
      entityId: row.id,
      summaryFr: `Horaire supprimé : ${row.labelFr}`,
      summaryEn: `Time deleted: ${row.labelFr}`,
    })
    return c.json({ ok: true })
  })
  .post('/exceptions', requirePermission('schedule:update'), async (c) => {
    const parsed = excBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const p = parsed.data
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [row] = await db
      .insert(scheduleExceptions)
      .values({ ...p, createdBy: actor?.userId })
      .returning()
    if (!row) return fail(c, 400, 'invalid')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'create',
      entityType: 'schedule_exception',
      entityId: row.id,
      summaryFr: `Changement d’horaire le ${p.date}`,
      summaryEn: `Schedule change on ${p.date}`,
    })
    return c.json({ id: row.id }, 201)
  })
  .delete('/exceptions/:id', requirePermission('schedule:update'), async (c) => {
    const db = await c.var.deps.db()
    const [row] = await db
      .delete(scheduleExceptions)
      .where(eq(scheduleExceptions.id, c.req.param('id')))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'schedule_exception',
      entityId: row.id,
      summaryFr: 'Changement d’horaire retiré',
      summaryEn: 'Schedule change removed',
    })
    return c.json({ ok: true })
  })

export { upcomingServices }
