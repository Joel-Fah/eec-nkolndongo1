/**
 * Communion cards API, mounted at /api/communion (decision 0050).
 * - Staff: people and cards (propose → approve by a second person, suspend/restore, withdraw, renew), the Elders' monthly visa, the
 *   contributions register, the expected-fee schedule, the sacrament confirmation, and the scanner check.
 * - Member: their own card (never anyone else's), the excuse for a month, and their baptism/confirmation declaration.
 * - Public: `GET /verify/:token`, which answers only « valid until … » or « not valid », with a first name and an initial. Rate-limited.
 * Amounts are never sent to a member as anything but « expected », and nothing about discipline is ever shown to them.
 */
import {
  type AppEnv,
  audit,
  clientIp,
  fail,
  publicRoute,
  requirePermission,
  requireSelf,
  signPreview,
  verifyPreview,
} from '@eec/api-kit'
import { allow, can, type Principal } from '@eec/auth'
import {
  ageBand,
  communionSunday,
  memberCode,
  monthState,
  monthsOf,
  nextMonth,
  preparationMonthOn,
  preparationWeek,
  streak,
} from '@eec/core'
import { consents, groupMembers, groups, profiles, user } from '@eec/db/schema'
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import qrcode from 'qrcode-generator'
import { z } from 'zod'
import {
  communionCards as cards,
  communionContributions as contributions,
  communionExcuses as excuses,
  communionFees as fees,
  communionVisas as visas,
} from './schema.ts'

const TOKEN = 'communion'
const uuid = /^[0-9a-f-]{36}$/
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())

export const proposeBody = z
  .object({ userId: z.uuid(), validUntil: z.iso.date().optional() })
  .strict()
export const visaBody = z.object({ month, signed: z.boolean() }).strict()
export const contributionBody = z
  .object({ month, amountXaf: z.number().int().min(0).max(10_000_000).nullable() })
  .strict()
export const feeBody = z
  .object({
    kind: z.enum(['age', 'group']),
    key: z.string().trim().min(1).max(40),
    amountXaf: z.number().int().min(0).max(10_000_000).nullable(),
  })
  .strict()

/** What a card is worth right now. A card that is not active is « not valid », whatever else is true. */
export function stateOf(c: { status: string; validUntil: string }, day = today()) {
  if (c.status === 'proposed') return 'proposed'
  if (c.status === 'withdrawn') return 'withdrawn'
  if (c.status === 'suspended') return 'suspended'
  return c.validUntil >= day ? 'valid' : 'expired'
}

const endOfYear = () => `${today().slice(0, 4)}-12-31`

/** The signed address the QR code carries: card id + version, so renewing a card stops the old code from working. */
async function qrFor(
  secret: string,
  origin: string,
  card: { id: string; version: number; validUntil: string },
) {
  const days = Math.max(
    1,
    Math.ceil((Date.parse(`${card.validUntil}T23:59:59Z`) - Date.now()) / 86_400_000) + 2,
  )
  const token = await signPreview(secret, TOKEN, `${card.id}:${card.version}`, days * 86_400)
  const qr = qrcode(0, 'M')
  const url = `${origin}/fr/verifier/?t=${token}`
  qr.addData(url)
  qr.make()
  return { svg: qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }), url }
}

export const communionApi = new Hono<AppEnv>()
  // ——— Staff: people ————————————————————————————————————————————
  .get('/people', requirePermission('communion:issue'), async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    if (q.length < 2) return c.json({ items: [] })
    const db = await c.var.deps.db()
    const like = `%${q.replace(/[%_]/g, '')}%`
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        baptised: profiles.baptised,
        confirmed: profiles.confirmed,
        confirmedAt: profiles.sacramentConfirmedAt,
        cardStatus: cards.status,
      })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .leftJoin(cards, eq(cards.userId, user.id))
      .where(or(ilike(user.name, like), ilike(user.email, like)))
      .orderBy(asc(user.name))
      .limit(20)
    return c.json({ items: rows })
  })

  // The baptism register says so: the secretariat or pasteur confirms (or takes back) a person's sacrament record.
  .put('/sacrament/:userId', requirePermission('communion:issue'), async (c) => {
    const userId = c.req.param('userId')
    const body = z
      .object({ confirmed: z.boolean() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!uuid.test(userId) || !body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const done = await db
      .update(profiles)
      .set(
        body.data.confirmed
          ? { sacramentConfirmedBy: actor?.userId ?? null, sacramentConfirmedAt: new Date() }
          : { sacramentConfirmedBy: null, sacramentConfirmedAt: null },
      )
      .where(eq(profiles.userId, userId))
      .returning({ id: profiles.userId })
    if (!done.length) return fail(c, 404, 'not_found')
    await audit(c, {
      action: 'communion.sacrament',
      entityType: 'user',
      entityId: userId,
      summaryFr: body.data.confirmed
        ? 'Baptême confirmé d’après le registre'
        : 'Confirmation du baptême retirée',
      summaryEn: body.data.confirmed
        ? 'Baptism confirmed from the register'
        : 'Baptism confirmation withdrawn',
    })
    return c.json({ ok: true })
  })

  // ——— Staff: cards ————————————————————————————————————————————
  .get('/cards', requirePermission('communion:read'), async (c) => {
    const m = month.safeParse(c.req.query('month') ?? today().slice(0, 7))
    if (!m.success) return fail(c, 400, 'invalid')
    const q = (c.req.query('q') ?? '').trim()
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const mayRegister = !!actor && can(actor.principal as Principal, 'communion:register-read')
    const rows = await db
      .select({
        id: cards.id,
        userId: user.id,
        name: user.name,
        status: cards.status,
        validUntil: cards.validUntil,
        proposedBy: cards.proposedBy,
        visa: sql<boolean>`exists (select 1 from ${visas} v where v.card_id = ${cards.id} and v.month = ${m.data})`,
        excused: sql<boolean>`exists (select 1 from ${excuses} e where e.card_id = ${cards.id} and e.month = ${m.data})`,
        amount: mayRegister
          ? sql<
              number | null
            >`(select amount_xaf from ${contributions} k where k.card_id = ${cards.id} and k.month = ${m.data})`
          : sql<null>`null`,
      })
      .from(cards)
      .innerJoin(user, eq(user.id, cards.userId))
      .where(q.length >= 2 ? ilike(user.name, `%${q.replace(/[%_]/g, '')}%`) : undefined)
      .orderBy(asc(user.name))
      .limit(400)
    return c.json({
      month: m.data,
      sunday: communionSunday(m.data),
      prep: preparationWeek(m.data),
      mayRegister,
      items: rows.map((r) => ({ ...r, state: stateOf(r) })),
    })
  })

  .post('/cards', requirePermission('communion:issue'), async (c) => {
    const body = proposeBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [p] = await db
      .select({ at: profiles.sacramentConfirmedAt })
      .from(profiles)
      .where(eq(profiles.userId, body.data.userId))
    if (!p) return fail(c, 404, 'not_found')
    // A card is for someone whose baptism the secretariat or pasteur has confirmed.
    if (!p.at) return fail(c, 409, 'sacrament_not_confirmed')
    const made = await db
      .insert(cards)
      .values({
        userId: body.data.userId,
        validUntil: body.data.validUntil ?? endOfYear(),
        proposedBy: actor?.userId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: cards.id })
    if (!made[0]) return fail(c, 409, 'already_has_card')
    await audit(c, {
      action: 'communion.propose',
      entityType: 'communion_card',
      entityId: made[0].id,
      summaryFr: 'Carte de Sainte-Cène proposée',
      summaryEn: 'Communion card proposed',
    })
    return c.json({ id: made[0].id }, 201)
  })

  // The second person: not the one who proposed.
  .post('/cards/:id/approve', requirePermission('communion:approve'), async (c) => {
    const id = c.req.param('id')
    if (!uuid.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [card] = await db.select().from(cards).where(eq(cards.id, id))
    if (!card) return fail(c, 404, 'not_found')
    if (card.status !== 'proposed') return fail(c, 409, 'not_proposed')
    if (card.proposedBy && card.proposedBy === actor?.userId)
      return fail(c, 403, 'second_person_required')
    await db
      .update(cards)
      .set({ status: 'active', approvedBy: actor?.userId ?? null, approvedAt: new Date() })
      .where(eq(cards.id, id))
    await audit(c, {
      action: 'communion.approve',
      entityType: 'communion_card',
      entityId: id,
      summaryFr: 'Carte de Sainte-Cène approuvée',
      summaryEn: 'Communion card approved',
    })
    return c.json({ ok: true })
  })

  // A new year: the card is renewed by a second person than the one who asks, and the old QR code stops working.
  .post('/cards/:id/renew', requirePermission('communion:approve'), async (c) => {
    const id = c.req.param('id')
    const body = z
      .object({ validUntil: z.iso.date() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!uuid.test(id) || !body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [card] = await db.select().from(cards).where(eq(cards.id, id))
    if (!card) return fail(c, 404, 'not_found')
    if (card.status === 'withdrawn' || card.status === 'proposed') return fail(c, 409, 'not_active')
    await db
      .update(cards)
      .set({ validUntil: body.data.validUntil, version: card.version + 1 })
      .where(eq(cards.id, id))
    await audit(c, {
      action: 'communion.renew',
      entityType: 'communion_card',
      entityId: id,
      summaryFr: `Carte de Sainte-Cène renouvelée jusqu’au ${body.data.validUntil}`,
      summaryEn: `Communion card renewed until ${body.data.validUntil}`,
    })
    return c.json({ ok: true })
  })

  // Suspension and restoring: the secretariat. The member is told « voyez le pasteur », never why.
  .post('/cards/:id/suspend', requirePermission('communion:suspend'), async (c) => {
    return setStatus(
      c,
      'suspended',
      ['active'],
      'communion.suspend',
      'Carte suspendue',
      'Card suspended',
    )
  })
  .post('/cards/:id/restore', requirePermission('communion:suspend'), async (c) => {
    return setStatus(
      c,
      'active',
      ['suspended'],
      'communion.restore',
      'Carte rétablie',
      'Card restored',
    )
  })
  // Withdrawal: the pasteur's act; the reason stays in the activity log only.
  .post('/cards/:id/withdraw', requirePermission('communion:approve'), async (c) => {
    return setStatus(
      c,
      'withdrawn',
      ['active', 'suspended', 'proposed'],
      'communion.withdraw',
      'Carte retirée',
      'Card withdrawn',
      true,
    )
  })

  // ——— Staff: visa, register, fees ————————————————————————————————
  .put('/cards/:id/visa', requirePermission('communion:visa'), async (c) => {
    const id = c.req.param('id')
    const body = visaBody.safeParse(await c.req.json().catch(() => null))
    if (!uuid.test(id) || !body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [card] = await db.select().from(cards).where(eq(cards.id, id))
    if (!card) return fail(c, 404, 'not_found')
    // Only a valid card is signed, and not in a month that has not started.
    if (stateOf(card) !== 'valid') return fail(c, 409, 'card_not_valid')
    if (body.data.month > today().slice(0, 7)) return fail(c, 400, 'future_month')
    if (body.data.signed)
      await db
        .insert(visas)
        .values({ cardId: id, month: body.data.month, signedBy: actor?.userId ?? null })
        .onConflictDoNothing()
    else await db.delete(visas).where(and(eq(visas.cardId, id), eq(visas.month, body.data.month)))
    await audit(c, {
      action: body.data.signed ? 'communion.visa' : 'communion.unvisa',
      entityType: 'communion_card',
      entityId: id,
      summaryFr: `${body.data.signed ? 'Visa' : 'Visa retiré'} : ${body.data.month}`,
      summaryEn: `${body.data.signed ? 'Visa' : 'Visa removed'}: ${body.data.month}`,
    })
    return c.json({ ok: true })
  })

  .put('/cards/:id/contribution', requirePermission('communion:register-write'), async (c) => {
    const id = c.req.param('id')
    const body = contributionBody.safeParse(await c.req.json().catch(() => null))
    if (!uuid.test(id) || !body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const [card] = await db.select({ id: cards.id }).from(cards).where(eq(cards.id, id))
    if (!card) return fail(c, 404, 'not_found')
    if (body.data.amountXaf === null)
      await db
        .delete(contributions)
        .where(and(eq(contributions.cardId, id), eq(contributions.month, body.data.month)))
    else
      await db
        .insert(contributions)
        .values({
          cardId: id,
          month: body.data.month,
          amountXaf: body.data.amountXaf,
          notedBy: actor?.userId ?? null,
        })
        .onConflictDoUpdate({
          target: [contributions.cardId, contributions.month],
          set: {
            amountXaf: body.data.amountXaf,
            notedBy: actor?.userId ?? null,
            notedAt: new Date(),
          },
        })
    // The amount is not written in the log: who noted a contribution, for which month.
    await audit(c, {
      action: 'communion.contribution',
      entityType: 'communion_card',
      entityId: id,
      summaryFr: `Cotisation notée : ${body.data.month}`,
      summaryEn: `Contribution noted: ${body.data.month}`,
    })
    return c.json({ ok: true })
  })

  .get('/fees', requirePermission('communion:read'), async (c) => {
    const db = await c.var.deps.db()
    const [list, gs] = await Promise.all([
      db.select().from(fees),
      db
        .select({ id: groups.id, nameFr: groups.nameFr, nameEn: groups.nameEn })
        .from(groups)
        .where(eq(groups.isActive, true))
        .orderBy(asc(groups.nameFr)),
    ])
    return c.json({
      items: list.map((f) => ({ kind: f.kind, key: f.key, amountXaf: f.amountXaf })),
      groups: gs,
    })
  })
  .put('/fees', requirePermission('communion:fees'), async (c) => {
    const body = feeBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    if (
      body.data.kind === 'age' &&
      !['under18', '18-25', '26-35', '36-50', '51-65', 'over65'].includes(body.data.key)
    )
      return fail(c, 400, 'invalid')
    if (body.data.kind === 'group' && !uuid.test(body.data.key)) return fail(c, 400, 'invalid')
    if (body.data.amountXaf === null)
      await db.delete(fees).where(and(eq(fees.kind, body.data.kind), eq(fees.key, body.data.key)))
    else
      await db
        .insert(fees)
        .values({
          kind: body.data.kind,
          key: body.data.key,
          amountXaf: body.data.amountXaf,
          updatedBy: actor?.userId ?? null,
        })
        .onConflictDoUpdate({
          target: [fees.kind, fees.key],
          set: {
            amountXaf: body.data.amountXaf,
            updatedBy: actor?.userId ?? null,
            updatedAt: new Date(),
          },
        })
    await audit(c, {
      action: 'communion.fee',
      entityType: 'communion_fee',
      summaryFr: 'Cotisation attendue modifiée',
      summaryEn: 'Expected contribution changed',
      diff: { kind: body.data.kind, key: body.data.key },
    })
    return c.json({ ok: true })
  })

  // ——— Staff: scanner ————————————————————————————————————————————
  .get('/check/:token', requirePermission('communion:verify'), async (c) => {
    const found = await lookup(c, c.req.param('token'))
    await audit(c, {
      action: 'communion.verify',
      entityType: 'communion_card',
      entityId: found.card?.id,
      summaryFr: `Carte vérifiée : ${found.state}`,
      summaryEn: `Card checked: ${found.state}`,
    })
    return c.json({
      state: found.state,
      until: found.card?.validUntil ?? null,
      name: found.card ? found.first : null,
    })
  })

  // ——— Public: the QR code leads here ————————————————————————————
  .get(
    '/verify/:token',
    publicRoute('Card check by signed address: rate-limited, first name and initial only'),
    async (c) => {
      c.header('cache-control', 'private, no-store')
      c.header('x-robots-tag', 'noindex, nofollow')
      const db = await c.var.deps.db()
      if (!(await allow(db, `verify:${clientIp(c)}`, 30, 600))) return fail(c, 429, 'rate_limited')
      const found = await lookup(c, c.req.param('token'))
      if (found.state !== 'valid' || !found.card) return c.json({ valid: false })
      return c.json({ valid: true, until: found.card.validUntil, name: found.first })
    },
  )

  // ——— Member: my card ————————————————————————————————————————————
  .get('/me', requireSelf(), async (c) => {
    c.header('cache-control', 'private, no-store')
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    // Two rounds to the database, not five: the card, the person, the fee schedule and my groups first; then the card's visas and excuses.
    const [[card], [who], feeRows, mine] = await Promise.all([
      db.select().from(cards).where(eq(cards.userId, actor.userId)),
      db
        .select({ name: user.name, first: profiles.firstName, birth: profiles.birthDate })
        .from(user)
        .innerJoin(profiles, eq(profiles.userId, user.id))
        .where(eq(user.id, actor.userId)),
      db.select().from(fees),
      db
        .select({ id: groupMembers.groupId, nameFr: groups.nameFr, nameEn: groups.nameEn })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(eq(groupMembers.userId, actor.userId)),
    ])
    // Someone who is not a communicant simply has no card: nothing is said about why.
    if (!card || card.status === 'withdrawn' || card.status === 'proposed')
      return c.json({ card: null })
    const [vs, es] = await Promise.all([
      db.select({ m: visas.month }).from(visas).where(eq(visas.cardId, card.id)),
      db.select({ m: excuses.month }).from(excuses).where(eq(excuses.cardId, card.id)),
    ])
    const signed = new Set(vs.map((v) => v.m))
    const excused = new Set(es.map((e) => e.m))
    const day = today()
    const since = card.createdAt.toISOString().slice(0, 7)
    const o = { signed, excused, since }
    const year = Number(day.slice(0, 4))
    const state = stateOf(card, day)
    const nowMonth = day.slice(0, 7)
    const prepMonth = preparationMonthOn(day)
    const upcoming =
      prepMonth ?? (day <= communionSunday(nowMonth) ? nowMonth : nextMonth(nowMonth))
    // What is expected, never what is owed: the age band's amount plus the groups' amounts.
    const band = ageBand(who?.birth ?? null, day)
    const lines = [
      ...feeRows
        .filter((f) => f.kind === 'age' && f.key === band)
        .map((f) => ({ kind: 'age', key: f.key, nameFr: '', nameEn: '', amountXaf: f.amountXaf })),
      ...feeRows
        .filter((f) => f.kind === 'group')
        .flatMap((f) => {
          const g = mine.find((x) => x.id === f.key)
          return g
            ? [
                {
                  kind: 'group',
                  key: f.key,
                  nameFr: g.nameFr,
                  nameEn: g.nameEn ?? g.nameFr,
                  amountXaf: f.amountXaf,
                },
              ]
            : []
        }),
    ]
    const origin = new URL(c.req.url).origin
    const qr = state === 'valid' ? await qrFor(c.env.AUTH_SECRET, origin, card) : null
    return c.json({
      card: {
        state,
        validUntil: card.validUntil,
        code: memberCode(actor.userId),
        name: who?.name ?? '',
        firstName: who?.first ?? '',
        months: monthsOf(year).map((m) => ({
          month: m,
          sunday: communionSunday(m),
          state: monthState(m, day, o),
        })),
        streak: streak(day, o),
        next: {
          month: upcoming,
          sunday: communionSunday(upcoming),
          prep: preparationWeek(upcoming),
          inPrep: prepMonth === upcoming,
          signed: signed.has(upcoming),
          excused: excused.has(upcoming),
        },
        expected: lines.length
          ? { total: lines.reduce((s, l) => s + l.amountXaf, 0), lines }
          : null,
        qr: qr?.svg ?? null,
        verifyUrl: qr?.url ?? null,
        checkedAt: new Date().toISOString(),
      },
    })
  })

  // « Excused » for a month: the member's word, no reason kept. A signed month cannot be excused; a past month cannot be changed.
  .put('/me/excuse', requireSelf(), async (c) => {
    const body = z
      .object({ month, excused: z.boolean() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const [card] = await db.select().from(cards).where(eq(cards.userId, actor.userId))
    if (card?.status !== 'active') return fail(c, 404, 'not_found')
    const day = today()
    if (communionSunday(body.data.month) < day) return fail(c, 400, 'past_month')
    const [signedAlready] = await db
      .select({ id: visas.id })
      .from(visas)
      .where(and(eq(visas.cardId, card.id), eq(visas.month, body.data.month)))
    if (signedAlready) return fail(c, 409, 'already_signed')
    if (body.data.excused)
      await db
        .insert(excuses)
        .values({ cardId: card.id, month: body.data.month })
        .onConflictDoNothing()
    else
      await db
        .delete(excuses)
        .where(and(eq(excuses.cardId, card.id), eq(excuses.month, body.data.month)))
    return c.json({ ok: true })
  })

  // My declaration (needs the profile consent): baptised, confirmed. The parish's confirmation is separate.
  .put('/me/sacrament', requireSelf(), async (c) => {
    const body = z
      .object({ baptised: z.boolean().nullable(), confirmed: z.boolean().nullable() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const db = await c.var.deps.db()
    const [consent] = await db
      .select({ id: consents.id })
      .from(consents)
      .where(
        and(
          eq(consents.userId, actor.userId),
          eq(consents.kind, 'profile'),
          isNull(consents.withdrawnAt),
        ),
      )
    if (!consent) return fail(c, 403, 'consent_required')
    await db
      .update(profiles)
      .set({ baptised: body.data.baptised, confirmed: body.data.confirmed })
      .where(eq(profiles.userId, actor.userId))
    return c.json({ ok: true })
  })

async function setStatus(
  c: import('hono').Context<AppEnv>,
  to: 'active' | 'suspended' | 'withdrawn',
  from: string[],
  action: string,
  fr: string,
  en: string,
  withReason = false,
) {
  const id = c.req.param('id') ?? ''
  if (!uuid.test(id)) return fail(c, 400, 'invalid')
  let reason: string | undefined
  if (withReason) {
    const b = z
      .object({ reason: z.string().trim().min(3).max(300) })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!b.success) return fail(c, 400, 'invalid')
    reason = b.data.reason
  }
  const db = await c.var.deps.db()
  const [card] = await db.select().from(cards).where(eq(cards.id, id))
  if (!card) return fail(c, 404, 'not_found')
  if (!from.includes(card.status)) return fail(c, 409, 'wrong_state')
  await db.update(cards).set({ status: to }).where(eq(cards.id, id))
  await audit(c, {
    action,
    entityType: 'communion_card',
    entityId: id,
    summaryFr: fr,
    summaryEn: en,
    diff: reason ? { reason } : undefined,
  })
  return c.json({ ok: true })
}

/** From a scanned token to the card and what it is worth now. A forged or old token is « unknown ». */
async function lookup(c: import('hono').Context<AppEnv>, token: string) {
  const sub = await verifyPreview(c.env.AUTH_SECRET, token, TOKEN)
  const [cardId, version] = (sub ?? '').split(':')
  if (!cardId || !uuid.test(cardId)) return { state: 'unknown' as const, card: null, first: '' }
  const db = await c.var.deps.db()
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId))
  if (!card || String(card.version) !== version)
    return { state: 'unknown' as const, card: null, first: '' }
  const [p] = await db
    .select({ first: profiles.firstName, last: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.userId, card.userId))
  // A first name and the initial of the last name, nothing more.
  const first =
    `${p?.first ?? ''} ${(p?.last ?? '').slice(0, 1).toUpperCase()}${p?.last ? '.' : ''}`.trim()
  return { state: stateOf(card), card, first }
}
