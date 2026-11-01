/**
 * Registrations API, mounted at /api/registrations (decision 0035).
 * - Public: the form and its open/full state (edge-cached), the signed fill-time token, SUBMIT (honeypot, minimum fill time,
 *   rate limit, explicit consent, guardian box for minors) and CANCEL (a signed, expiring link: no account).
 * - Staff: forms (group-scoped), the people who signed up (with their phone numbers: `read`), adding and cancelling by hand,
 *   check-in (names only, `manage`), CSV export (`export`, audited with the number of rows, never the content), deletion.
 * A registration is kept 6 months after the event (12 months after the form closed at most); the daily job in apps/api deletes it
 * and keeps anonymised totals. A cancellation promotes the next person on the waitlist, and the notice goes to the outbox.
 */
import {
  type AppEnv,
  audit,
  bumpContentVersion,
  cachedJson,
  clientIp,
  fail,
  mayOn,
  publicRoute,
  requirePermission,
  requirePermissionAnywhere,
  requireSelf,
  signPreview,
  verifyPreview,
  versionFor,
} from '@eec/api-kit'
import { allow } from '@eec/auth'
import {
  AGE_BANDS,
  daysLeft,
  normalizePhone,
  purgeOn,
  REGISTRATION_RETENTION,
  retentionLevel,
  slugify,
  uniqueSlug,
} from '@eec/core'
import type { Db } from '@eec/db'
import { mailOutbox, notifications } from '@eec/db/schema'
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  availability,
  cancelLinkSeconds,
  checkAnswers,
  csvCell,
  looksSensitive,
  newCode,
  placeFor,
  spotsLeft,
} from './rules.ts'
import {
  FIELD_KINDS,
  type FormField,
  registrationCounts,
  registrationForms,
  registrationPeople,
  registrations,
} from './schema.ts'

const AREA = 'registrations'
const CANCEL_ENTITY = 'regcancel'
const FILL_ENTITY = 'regform'
const MIN_FILL_MS = 4000
const MAX_FILL_MS = 6 * 60 * 60 * 1000

type Locale = 'fr' | 'en'
const localeOf = (v: string | undefined): Locale => (v === 'en' ? 'en' : 'fr')
type Form = typeof registrationForms.$inferSelect
type Reg = typeof registrations.$inferSelect

// ——— Bodies ——————————————————————————————————————————————————————
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const text = (max: number) => z.string().trim().max(max)
const option = z.object({ fr: text(80).min(1), en: text(80) }).strict()
const field = z
  .object({
    id: z.string().regex(/^[a-z0-9]{3,12}$/),
    kind: z.enum(FIELD_KINDS),
    labelFr: text(120).min(1),
    labelEn: text(120),
    required: z.boolean(),
    options: z.array(option).max(12),
  })
  .strict()
export const formBody = z
  .object({
    titleFr: text(120).min(1),
    titleEn: text(120),
    introFr: text(600),
    introEn: text(600),
    groupId: z.uuid().nullable(),
    eventSlug: text(120).nullable(),
    eventDate: day,
    opensAt: z.iso.datetime().nullable(),
    closesAt: z.iso.datetime().nullable(),
    capacity: z.number().int().min(1).max(5000).nullable(),
    waitlist: z.boolean(),
    audience: z.enum(['open', 'members']),
    forMinors: z.boolean(),
    askWhatsapp: z.boolean(),
    state: z.enum(['draft', 'published']),
    fields: z.array(field).max(8),
  })
  .partial()
  .strict()
  .superRefine((b, ctx) => {
    for (const f of b.fields ?? []) {
      const needsOptions = f.kind === 'choice' || f.kind === 'multi'
      if (looksSensitive(f.labelFr) || looksSensitive(f.labelEn))
        ctx.addIssue({ code: 'custom', path: ['fields'], message: 'sensitive' })
      if (needsOptions && f.options.length < 2)
        ctx.addIssue({ code: 'custom', path: ['fields'], message: 'options' })
    }
  })
const person = z.object({ firstName: text(40).min(1), ageBand: z.enum(AGE_BANDS) }).strict()
const party = {
  name: text(80).min(2),
  phone: text(40).min(1),
  whatsapp: text(40).default(''),
  email: z.union([z.literal(''), z.email().max(120)]).default(''),
  partySize: z.number().int().min(1).max(10).default(1),
  children: z.array(person).max(10).default([]),
  guardian: z.boolean().default(false),
  answers: z.record(z.string(), z.unknown()).default({}),
}
export const submitBody = z
  .object({
    slug: z.string().min(1).max(120),
    ...party,
    consent: z.literal(true),
    website: z.string().max(200).default(''),
    token: z.string().min(10).max(300),
  })
  .strict()
export const manualBody = z.object({ ...party }).strict()
export const actionBody = z
  .object({
    action: z.enum(['cancel', 'confirm', 'notified', 'checkin', 'uncheckin']),
    personId: z.uuid().optional(),
  })
  .strict()

// ——— Helpers ————————————————————————————————————————————————————
const addressKey = async (secret: string, ip: string) => {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${secret}:registration:${ip}`),
  )
  return [...new Uint8Array(hash)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** People already counted against the places of a form (confirmed registrations, children included in the party size). */
async function takenOf(db: Db, formId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${registrations.partySize}), 0)::int` })
    .from(registrations)
    .where(and(eq(registrations.formId, formId), eq(registrations.status, 'confirmed')))
  return row?.n ?? 0
}

/** The Monday (YYYY-MM-DD) of the week a day falls in: how notifications are grouped. */
const mondayOf = (d: Date) => {
  const day = (d.getUTCDay() + 6) % 7
  return new Date(d.getTime() - day * 86_400_000).toISOString().slice(0, 10)
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/** After a place opens: the next people on the waitlist who fit move up, in the order they came, and the secretariat is told. */
async function promoteWaitlist(db: Db, form: Form): Promise<number> {
  if (form.capacity == null) return 0
  let free = form.capacity - (await takenOf(db, form.id))
  const waiting = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.formId, form.id), eq(registrations.status, 'waitlist')))
    .orderBy(asc(registrations.createdAt), asc(registrations.id))
  let moved = 0
  for (const r of waiting) {
    if (r.partySize > free) break
    await db
      .update(registrations)
      .set({ status: 'confirmed', promotedAt: new Date(), updatedAt: new Date() })
      .where(eq(registrations.id, r.id))
    // First name and phone only; the outbox keeps it 90 days (decision 0019).
    await db.insert(mailOutbox).values({
      toEmail: r.email,
      template: 'registration-promoted',
      locale: 'fr',
      payload: { firstName: firstName(r.name), phone: r.phone, form: form.titleFr, code: r.code },
    })
    // A member who registered signed in is told in Mon espace (the kind and the title only; the words are written on screen).
    if (r.userId)
      await db
        .insert(notifications)
        .values({
          userId: r.userId,
          kind: 'waitlist_promoted',
          ref: r.id,
          params: { title: form.titleFr, titleEn: form.titleEn },
          href: 'account:inscriptions',
          weekOf: mondayOf(new Date()),
        })
        .onConflictDoNothing()
    free -= r.partySize
    moved++
  }
  return moved
}

const retentionOf = (f: Pick<Form, 'eventDate' | 'closesAt'>, now = new Date()) => {
  const on = purgeOn(f.eventDate, f.closesAt)
  const days = daysLeft(on, now)
  return { purgeOn: on, daysLeft: days, level: retentionLevel(days) }
}

const publicForm = (f: Form, taken: number, locale: Locale, now = new Date()) => {
  const en = locale === 'en'
  return {
    slug: f.slug,
    title: (en && f.titleEn) || f.titleFr,
    intro: (en && f.introEn) || f.introFr,
    eventSlug: f.eventSlug,
    eventDate: f.eventDate,
    audience: f.audience,
    forMinors: f.forMinors,
    askWhatsapp: f.askWhatsapp,
    waitlist: f.waitlist,
    state: availability(f, taken, now),
    spotsLeft: spotsLeft(f.capacity, taken),
    fields: f.fields.map((x) => ({
      id: x.id,
      kind: x.kind,
      label: (en && x.labelEn) || x.labelFr,
      required: x.required,
      // The stored answer is the French option; the label shown follows the language.
      options: x.options.map((o) => ({ value: o.fr, label: (en && o.en) || o.fr })),
    })),
  }
}

async function counts(db: Db, formIds: string[]) {
  if (formIds.length === 0)
    return new Map<
      string,
      {
        confirmed: number
        waitlist: number
        cancelled: number
        present: number
        registrations: number
      }
    >()
  const rows = await db
    .select({
      formId: registrations.formId,
      confirmed: sql<number>`coalesce(sum(${registrations.partySize}) filter (where ${registrations.status} = 'confirmed'), 0)::int`,
      waitlist: sql<number>`coalesce(sum(${registrations.partySize}) filter (where ${registrations.status} = 'waitlist'), 0)::int`,
      cancelled: sql<number>`count(*) filter (where ${registrations.status} = 'cancelled')::int`,
      present: sql<number>`count(*) filter (where ${registrations.checkedInAt} is not null)::int`,
      n: count(),
    })
    .from(registrations)
    .where(inArray(registrations.formId, formIds))
    .groupBy(registrations.formId)
  return new Map(
    rows.map((r) => [
      r.formId,
      {
        confirmed: r.confirmed,
        waitlist: r.waitlist,
        cancelled: r.cancelled,
        present: r.present,
        registrations: r.n,
      },
    ]),
  )
}

const staffForm = (
  f: Form,
  c?: {
    confirmed: number
    waitlist: number
    cancelled: number
    present: number
    registrations: number
  },
) => ({
  ...f,
  counts: c ?? { confirmed: 0, waitlist: 0, cancelled: 0, present: 0, registrations: 0 },
  retention: retentionOf(f),
  retentionRule: REGISTRATION_RETENTION,
})

const regRow = (
  r: Reg,
  kids: { id: string; firstName: string; ageBand: string; checkedInAt: Date | null }[],
) => ({
  ...r,
  people: kids,
})

async function loadForm(db: Db, id: string): Promise<Form | undefined> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined
  const [f] = await db.select().from(registrationForms).where(eq(registrationForms.id, id))
  return f
}

/** Writes a registration (public or by hand): the code, the children, the race check on capacity. */
async function writeRegistration(
  db: Db,
  form: Form,
  input: {
    name: string
    phone: string
    whatsapp: string
    email: string
    partySize: number
    children: { firstName: string; ageBand: string }[]
    guardian: boolean
    answers: Reg['answers']
    status: 'confirmed' | 'waitlist'
    policyVersion: string
    userId: string | null
    addedBy: string | null
  },
): Promise<{ reg: Reg; status: 'confirmed' | 'waitlist' } | { error: 'full' }> {
  let reg: Reg | undefined
  for (let i = 0; i < 6 && !reg; i++) {
    try {
      const [row] = await db
        .insert(registrations)
        .values({
          formId: form.id,
          code: newCode(),
          status: input.status,
          name: input.name,
          phone: input.phone,
          whatsapp: input.whatsapp,
          email: input.email,
          partySize: input.partySize,
          answers: input.answers,
          guardianConfirmed: input.guardian,
          consentAt: new Date(),
          policyVersion: input.policyVersion,
          userId: input.userId,
          addedBy: input.addedBy,
        })
        .returning()
      reg = row
    } catch (e) {
      if (!/registrations_code_idx|duplicate key/.test(String((e as Error).message))) throw e
    }
  }
  if (!reg) throw new Error('code')
  const regId = reg.id
  if (input.children.length)
    await db
      .insert(registrationPeople)
      .values(input.children.map((c) => ({ registrationId: regId, ...c })))
  // Two people may have taken the last place at the same moment: the one who came second moves to the waitlist.
  if (reg.status === 'confirmed' && form.capacity != null) {
    const earlier = await db
      .select({ n: sql<number>`coalesce(sum(${registrations.partySize}), 0)::int` })
      .from(registrations)
      .where(
        and(
          eq(registrations.formId, form.id),
          eq(registrations.status, 'confirmed'),
          sql`(${registrations.createdAt}, ${registrations.id}) <= (select r2.created_at, r2.id from registrations r2 where r2.id = ${reg.id})`,
        ),
      )
    if ((earlier[0]?.n ?? 0) > form.capacity) {
      if (!form.waitlist) {
        await db.delete(registrations).where(eq(registrations.id, reg.id))
        return { error: 'full' }
      }
      const [moved] = await db
        .update(registrations)
        .set({ status: 'waitlist' })
        .where(eq(registrations.id, reg.id))
        .returning()
      reg = moved ?? reg
    }
  }
  return { reg, status: reg.status as 'confirmed' | 'waitlist' }
}

/** The shared checks of a party: phone(s), the answers to the form's questions, the guardian box and the children. */
function checkParty(
  form: Form,
  b: z.infer<z.ZodObject<typeof party>>,
):
  | { ok: true; phone: string; whatsapp: string; answers: Reg['answers']; partySize: number }
  | { ok: false; code: string } {
  const phone = normalizePhone(b.phone)
  if (!phone) return { ok: false, code: 'bad_phone' }
  let whatsapp = ''
  if (b.whatsapp.trim()) {
    const w = normalizePhone(b.whatsapp)
    if (!w) return { ok: false, code: 'bad_whatsapp' }
    whatsapp = w.e164 === phone.e164 ? '' : w.e164
  }
  if (form.forMinors) {
    if (!b.guardian) return { ok: false, code: 'guardian_required' }
    if (b.children.length === 0) return { ok: false, code: 'children_required' }
  } else if (b.children.length > 0) return { ok: false, code: 'invalid' }
  const checked = checkAnswers(form.fields, b.answers)
  if (checked.problems.length) return { ok: false, code: 'answers' }
  // A form for minors counts the registrant and each child; another form takes the party size as typed.
  const partySize = form.forMinors ? 1 + b.children.length : b.partySize
  return { ok: true, phone: phone.e164, whatsapp, answers: checked.answers, partySize }
}

const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')

export const registrationsApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/token', async (c) => {
    const token = await signPreview(
      c.env.AUTH_SECRET,
      FILL_ENTITY,
      String(Math.floor(Date.now() / 1000)),
      MAX_FILL_MS / 1000,
    )
    c.header('cache-control', 'no-store')
    return c.json({ token })
  })
  .get('/public/form/:slug', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const slug = c.req.param('slug')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `registrations/form/${locale}/${slug}/v${version}`,
      ttl: 30,
      keep: 60 * 60 * 24,
      load: async (db) => {
        const [f] = await db
          .select()
          .from(registrationForms)
          .where(eq(registrationForms.slug, slug))
        if (!f || f.state !== 'published') return { form: null }
        return { form: publicForm(f, await takenOf(db, f.id), locale) }
      },
    })
  })
  // The form of an event, if it has one: for the « S’inscrire » button on the event's page.
  .get('/public/by-event/:eventSlug', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const eventSlug = c.req.param('eventSlug')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `registrations/event/${locale}/${eventSlug}/v${version}`,
      ttl: 30,
      keep: 60 * 60 * 24,
      load: async (db) => {
        const [f] = await db
          .select()
          .from(registrationForms)
          .where(
            and(
              eq(registrationForms.eventSlug, eventSlug),
              eq(registrationForms.state, 'published'),
            ),
          )
        if (!f) return { form: null }
        const p = publicForm(f, await takenOf(db, f.id), locale)
        return {
          form: {
            slug: p.slug,
            title: p.title,
            state: p.state,
            spotsLeft: p.spotsLeft,
            audience: p.audience,
          },
        }
      },
    })
  })
  .post(
    '/submit',
    publicRoute(
      'Public registration: honeypot, minimum fill time, rate limit, explicit unticked consent, guardian box for minors, no payment',
    ),
    async (c) => {
      const parsed = submitBody.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) return fail(c, 400, 'invalid')
      const b = parsed.data
      if (b.website.trim() !== '') return c.json({ ok: true, status: 'confirmed', code: 'XXXXXX' })
      const issued = await verifyPreview(c.env.AUTH_SECRET, b.token, FILL_ENTITY)
      if (!issued || !(Date.now() - Number(issued) * 1000 >= MIN_FILL_MS))
        return fail(c, 400, 'too_fast')
      const db = await c.var.deps.db()
      const key = await addressKey(c.env.AUTH_SECRET, clientIp(c) ?? 'unknown')
      // Many phones share one mobile-network address here: 30 an hour per address, not fewer.
      if (!(await allow(db, `registration:${key}`, 30, 3600))) return fail(c, 429, 'rate_limited')
      const [form] = await db
        .select()
        .from(registrationForms)
        .where(eq(registrationForms.slug, b.slug))
      if (!form || form.state !== 'published') return fail(c, 404, 'not_found')
      const actor = await c.var.deps.actor()
      if (form.audience === 'members' && actor?.principal.status !== 'active')
        return fail(c, 401, 'members_only')
      const taken = await takenOf(db, form.id)
      const state = availability(form, taken)
      if (state !== 'open') return fail(c, 409, state)
      const checked = checkParty(form, b)
      if (!checked.ok) return fail(c, 400, checked.code)
      // Registering twice with the same phone is almost always a double tap.
      const [dup] = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(
          and(
            eq(registrations.formId, form.id),
            eq(registrations.phone, checked.phone),
            ne(registrations.status, 'cancelled'),
          ),
        )
      if (dup) return fail(c, 409, 'duplicate')
      const place = placeFor(form.capacity, taken, checked.partySize, form.waitlist)
      if (!place) return fail(c, 409, 'full')
      const written = await writeRegistration(db, form, {
        name: b.name,
        phone: checked.phone,
        whatsapp: checked.whatsapp,
        email: b.email,
        partySize: checked.partySize,
        children: b.children,
        guardian: b.guardian,
        answers: checked.answers,
        status: place,
        policyVersion: await c.var.deps.policy(),
        userId: actor?.principal.status === 'active' ? actor.userId : null,
        addedBy: null,
      })
      if ('error' in written) return fail(c, 409, 'full')
      await bumpContentVersion(db, AREA)
      const position =
        written.status === 'waitlist'
          ? ((
              await db
                .select({ n: count() })
                .from(registrations)
                .where(
                  and(
                    eq(registrations.formId, form.id),
                    eq(registrations.status, 'waitlist'),
                    sql`(${registrations.createdAt}, ${registrations.id}) <= (select r2.created_at, r2.id from registrations r2 where r2.id = ${written.reg.id})`,
                  ),
                )
            )[0]?.n ?? 1)
          : 0
      const cancelToken = await signPreview(
        c.env.AUTH_SECRET,
        CANCEL_ENTITY,
        written.reg.id,
        cancelLinkSeconds(form.eventDate),
      )
      c.header('cache-control', 'no-store')
      return c.json(
        { ok: true, status: written.status, code: written.reg.code, position, cancelToken },
        201,
      )
    },
  )
  // ——— The signed-in member's own registrations (Mon espace, Phase 05) ———————————————————————
  // Linked when the person registered signed in (`user_id`), or by opening the signed cancel link (see /mine/claim).
  .get('/mine', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    c.header('cache-control', 'private, no-store')
    const db = await c.var.deps.db()
    const en = localeOf(c.req.query('locale')) === 'en'
    const rows = await db
      .select({ r: registrations, f: registrationForms })
      .from(registrations)
      .innerJoin(registrationForms, eq(registrationForms.id, registrations.formId))
      .where(eq(registrations.userId, actor.userId))
      .orderBy(desc(registrationForms.eventDate))
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
    const items = []
    for (const { r, f } of rows) {
      let position: number | null = null
      if (r.status === 'waitlist') {
        const [ahead] = await db
          .select({ n: count() })
          .from(registrations)
          .where(
            and(
              eq(registrations.formId, f.id),
              eq(registrations.status, 'waitlist'),
              sql`${registrations.createdAt} < ${r.createdAt}`,
            ),
          )
        position = (ahead?.n ?? 0) + 1
      }
      items.push({
        id: r.id,
        code: r.code,
        status: r.status,
        partySize: r.partySize,
        position,
        title: (en && f.titleEn) || f.titleFr,
        eventDate: f.eventDate,
        eventSlug: f.eventSlug,
        upcoming: f.eventDate >= today,
        purgeOn: retentionOf(f).purgeOn,
      })
    }
    return c.json({ items })
  })
  .post('/mine/:id/cancel', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const [reg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.id, id), eq(registrations.userId, actor.userId)))
    if (!reg) return fail(c, 404, 'not_found')
    if (reg.status !== 'cancelled') {
      await db
        .update(registrations)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(registrations.id, id))
      const form = await loadForm(db, reg.formId)
      if (form && reg.status === 'confirmed') await promoteWaitlist(db, form)
      await bumpContentVersion(db, AREA)
      await audit(c, {
        action: 'update',
        entityType: 'registration',
        entityId: id,
        summaryFr: 'Inscription annulée par la personne',
        summaryEn: 'Registration cancelled by its owner',
      })
    }
    return c.json({ ok: true })
  })
  // « Relier »: whoever holds the signed cancel link of a registration made without an account can attach it to their account.
  // Holding the link proves it is theirs; nothing is ever matched on a phone number or an e-mail address.
  .post('/mine/claim', requireSelf(), async (c) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const body = z
      .object({ token: z.string().min(10).max(600) })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    if (!(await allow(db, `claim:${actor.userId}`, 10, 3600))) return fail(c, 429, 'rate_limited')
    // The member may paste the whole link: the token is its `t` parameter.
    let raw = body.data.token.trim()
    try {
      raw = new URL(raw).searchParams.get('t') ?? raw
    } catch {
      // not a link: it is the token itself
    }
    const id = await verifyPreview(c.env.AUTH_SECRET, raw, CANCEL_ENTITY)
    if (!id) return fail(c, 400, 'invalid_link')
    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id))
    if (!reg) return fail(c, 404, 'not_found')
    if (reg.userId && reg.userId !== actor.userId) return fail(c, 409, 'taken')
    if (!reg.userId) {
      await db
        .update(registrations)
        .set({ userId: actor.userId, updatedAt: new Date() })
        .where(eq(registrations.id, id))
      await audit(c, {
        action: 'update',
        entityType: 'registration',
        entityId: id,
        summaryFr: 'Inscription reliée à un compte par la personne',
        summaryEn: 'Registration linked to an account by its owner',
      })
    }
    return c.json({ ok: true })
  })
  // What the cancel page shows before asking: the activity and the first name, nothing more.
  .get('/public/cancel', async (c) => {
    const id = await verifyPreview(c.env.AUTH_SECRET, c.req.query('t') ?? '', CANCEL_ENTITY)
    c.header('cache-control', 'no-store')
    if (!id) return fail(c, 404, 'invalid_link')
    const db = await c.var.deps.db()
    const [row] = await db
      .select({ r: registrations, f: registrationForms })
      .from(registrations)
      .innerJoin(registrationForms, eq(registrationForms.id, registrations.formId))
      .where(eq(registrations.id, id))
    if (!row) return fail(c, 404, 'invalid_link')
    const en = localeOf(c.req.query('locale')) === 'en'
    return c.json({
      title: (en && row.f.titleEn) || row.f.titleFr,
      eventDate: row.f.eventDate,
      firstName: firstName(row.r.name),
      code: row.r.code,
      status: row.r.status,
    })
  })
  .post(
    '/cancel',
    publicRoute(
      'Cancel one registration with its signed, expiring link: no account, no personal data in the reply',
    ),
    async (c) => {
      const body = z
        .object({ token: z.string().min(10).max(300) })
        .strict()
        .safeParse(await c.req.json().catch(() => null))
      if (!body.success) return fail(c, 400, 'invalid')
      const id = await verifyPreview(c.env.AUTH_SECRET, body.data.token, CANCEL_ENTITY)
      if (!id) return fail(c, 400, 'invalid_link')
      const db = await c.var.deps.db()
      const [reg] = await db.select().from(registrations).where(eq(registrations.id, id))
      if (!reg) return fail(c, 404, 'not_found')
      if (reg.status !== 'cancelled') {
        await db
          .update(registrations)
          .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
          .where(eq(registrations.id, id))
        const form = await loadForm(db, reg.formId)
        if (form && reg.status === 'confirmed') await promoteWaitlist(db, form)
        await bumpContentVersion(db, AREA)
      }
      c.header('cache-control', 'no-store')
      return c.json({ ok: true })
    },
  )

  // ——— Staff: forms ——————————————————————————————————————————
  .get('/forms', requirePermissionAnywhere('registrations:read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select()
      .from(registrationForms)
      .orderBy(desc(registrationForms.eventDate))
    const allowed: Form[] = []
    for (const f of rows) if (await mayOn(c, 'registrations:read', f.groupId)) allowed.push(f)
    const by = await counts(
      db,
      allowed.map((f) => f.id),
    )
    return c.json({ items: allowed.map((f) => staffForm(f, by.get(f.id))) })
  })
  .get('/forms/:id', requirePermissionAnywhere('registrations:read'), async (c) => {
    const db = await c.var.deps.db()
    const f = await loadForm(db, c.req.param('id'))
    if (!f || !(await mayOn(c, 'registrations:read', f.groupId))) return fail(c, 404, 'not_found')
    return c.json(staffForm(f, (await counts(db, [f.id])).get(f.id)))
  })
  .post('/forms', requirePermissionAnywhere('registrations:edit'), async (c) => {
    const parsed = formBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || !parsed.data.titleFr || !parsed.data.eventDate)
      return fail(c, 400, 'invalid')
    const b = parsed.data
    const titleFr = parsed.data.titleFr
    const eventDate = parsed.data.eventDate
    if (!titleFr || !eventDate) return fail(c, 400, 'invalid')
    // A registration always belongs to an event of the Calendar (an event may have none).
    if (!b.eventSlug) return fail(c, 400, 'event_required')
    if (!(await mayOn(c, 'registrations:edit', b.groupId ?? null))) return fail(c, 403, 'forbidden')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    // These words are part of the public addresses (…/inscription/annuler/): no form may take them.
    const taken = new Set([
      'inscription',
      'register',
      'annuler',
      'cancel',
      ...(await db.select({ s: registrationForms.slug }).from(registrationForms)).map((r) => r.s),
    ])
    const slug = uniqueSlug(slugify(titleFr).slice(0, 60), (s) => taken.has(s))
    const [row] = await db
      .insert(registrationForms)
      .values({
        slug,
        titleFr,
        titleEn: b.titleEn ?? '',
        introFr: b.introFr ?? '',
        introEn: b.introEn ?? '',
        groupId: b.groupId ?? null,
        eventSlug: b.eventSlug || null,
        eventDate,
        opensAt: b.opensAt ? new Date(b.opensAt) : null,
        closesAt: b.closesAt ? new Date(b.closesAt) : null,
        capacity: b.capacity ?? null,
        waitlist: b.waitlist ?? true,
        audience: b.audience ?? 'open',
        forMinors: b.forMinors ?? false,
        askWhatsapp: b.askWhatsapp ?? true,
        fields: (b.fields ?? []) as FormField[],
        createdBy: actor?.userId,
        updatedBy: actor?.userId,
      })
      .returning()
    if (!row) throw new Error('insert failed')
    await audit(c, {
      action: 'create',
      entityType: 'registration_form',
      entityId: row.id,
      summaryFr: 'Formulaire d’inscription créé',
      summaryEn: 'Registration form created',
    })
    return c.json({ id: row.id }, 201)
  })
  .patch('/forms/:id', requirePermissionAnywhere('registrations:edit'), async (c) => {
    const parsed = formBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const b = parsed.data
    const db = await c.var.deps.db()
    const f = await loadForm(db, c.req.param('id'))
    if (!f || !(await mayOn(c, 'registrations:edit', f.groupId))) return fail(c, 404, 'not_found')
    if (b.groupId !== undefined && !(await mayOn(c, 'registrations:edit', b.groupId)))
      return fail(c, 403, 'forbidden')
    const actor = await c.var.deps.actor()
    if (b.state === 'published' && !(b.eventSlug ?? f.eventSlug))
      return fail(c, 400, 'event_required')
    const set: Partial<typeof registrationForms.$inferInsert> = {
      updatedBy: actor?.userId,
      updatedAt: new Date(),
    }
    for (const key of [
      'titleFr',
      'titleEn',
      'introFr',
      'introEn',
      'groupId',
      'eventSlug',
      'eventDate',
      'capacity',
      'waitlist',
      'audience',
      'forMinors',
      'askWhatsapp',
      'state',
    ] as const)
      if (b[key] !== undefined)
        (set as Record<string, unknown>)[key] = key === 'eventSlug' ? b[key] || null : b[key]
    if (b.opensAt !== undefined) set.opensAt = b.opensAt ? new Date(b.opensAt) : null
    if (b.closesAt !== undefined) set.closesAt = b.closesAt ? new Date(b.closesAt) : null
    if (b.fields !== undefined) set.fields = b.fields as FormField[]
    const [row] = await db
      .update(registrationForms)
      .set(set)
      .where(eq(registrationForms.id, f.id))
      .returning()
    if (!row) return fail(c, 404, 'not_found')
    // More places → the waitlist moves up.
    if (b.capacity !== undefined) await promoteWaitlist(db, row)
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'registration_form',
      entityId: row.id,
      summaryFr: 'Formulaire d’inscription modifié',
      summaryEn: 'Registration form edited',
      diff: { fields: Object.keys(b) },
    })
    return c.json({ ok: true })
  })
  .delete('/forms/:id', requirePermissionAnywhere('registrations:delete'), async (c) => {
    const db = await c.var.deps.db()
    const f = await loadForm(db, c.req.param('id'))
    if (!f || !(await mayOn(c, 'registrations:delete', f.groupId))) return fail(c, 404, 'not_found')
    // The totals survive (anonymous): write them before the people go.
    await writeCounts(db, f)
    await db.delete(registrationForms).where(eq(registrationForms.id, f.id))
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'registration_form',
      entityId: f.id,
      summaryFr: 'Formulaire d’inscription supprimé',
      summaryEn: 'Registration form deleted',
    })
    return c.json({ ok: true })
  })

  // ——— Staff: the people ——————————————————————————————————————
  .get('/forms/:id/registrations', requirePermissionAnywhere('registrations:read'), async (c) => {
    const db = await c.var.deps.db()
    const f = await loadForm(db, c.req.param('id'))
    if (!f || !(await mayOn(c, 'registrations:read', f.groupId))) return fail(c, 404, 'not_found')
    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.formId, f.id))
      .orderBy(asc(registrations.createdAt), asc(registrations.id))
    const kids = rows.length
      ? await db
          .select()
          .from(registrationPeople)
          .where(
            inArray(
              registrationPeople.registrationId,
              rows.map((r) => r.id),
            ),
          )
      : []
    return c.json({
      form: staffForm(f, (await counts(db, [f.id])).get(f.id)),
      items: rows.map((r) =>
        regRow(
          r,
          kids.filter((k) => k.registrationId === r.id),
        ),
      ),
    })
  })
  .post(
    '/forms/:id/registrations',
    requirePermissionAnywhere('registrations:manage'),
    async (c) => {
      const parsed = manualBody.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) return fail(c, 400, 'invalid')
      const db = await c.var.deps.db()
      const f = await loadForm(db, c.req.param('id'))
      if (!f || !(await mayOn(c, 'registrations:manage', f.groupId)))
        return fail(c, 404, 'not_found')
      const checked = checkParty(f, parsed.data)
      if (!checked.ok) return fail(c, 400, checked.code)
      // By hand follows the same capacity rule: a full form puts the person on the waitlist (staff can still « Confirmer »).
      const place = placeFor(f.capacity, await takenOf(db, f.id), checked.partySize, true)
      if (!place) return fail(c, 409, 'full')
      const actor = await c.var.deps.actor()
      const written = await writeRegistration(db, f, {
        name: parsed.data.name,
        phone: checked.phone,
        whatsapp: checked.whatsapp,
        email: parsed.data.email,
        partySize: checked.partySize,
        children: parsed.data.children,
        guardian: parsed.data.guardian,
        answers: checked.answers,
        status: place,
        policyVersion: `${await c.var.deps.policy()}+oral`,
        userId: null,
        addedBy: actor?.userId ?? null,
      })
      if ('error' in written) return fail(c, 409, 'full')
      await bumpContentVersion(db, AREA)
      await audit(c, {
        action: 'create',
        entityType: 'registration',
        entityId: written.reg.id,
        summaryFr: 'Inscription ajoutée à la main',
        summaryEn: 'Registration added by hand',
      })
      return c.json({ id: written.reg.id, code: written.reg.code, status: written.status }, 201)
    },
  )
  .patch('/registrations/:id', requirePermissionAnywhere('registrations:manage'), async (c) => {
    const parsed = actionBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 404, 'not_found')
    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id))
    const form = reg ? await loadForm(db, reg.formId) : undefined
    if (!reg || !form || !(await mayOn(c, 'registrations:manage', form.groupId)))
      return fail(c, 404, 'not_found')
    const { action, personId } = parsed.data
    const now = new Date()
    if (action === 'cancel') {
      await db
        .update(registrations)
        .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
        .where(eq(registrations.id, id))
      if (reg.status === 'confirmed') await promoteWaitlist(db, form)
    } else if (action === 'confirm') {
      // From the waitlist (or a cancellation taken back): staff may go over capacity on purpose.
      await db
        .update(registrations)
        .set({ status: 'confirmed', cancelledAt: null, promotedAt: now, updatedAt: now })
        .where(eq(registrations.id, id))
    } else if (action === 'notified') {
      await db
        .update(registrations)
        .set({ notifiedAt: now, updatedAt: now })
        .where(eq(registrations.id, id))
    } else if (personId) {
      await db
        .update(registrationPeople)
        .set({ checkedInAt: action === 'checkin' ? now : null })
        .where(and(eq(registrationPeople.id, personId), eq(registrationPeople.registrationId, id)))
    } else {
      await db
        .update(registrations)
        .set({ checkedInAt: action === 'checkin' ? now : null, updatedAt: now })
        .where(eq(registrations.id, id))
    }
    await bumpContentVersion(db, AREA)
    // The audit line never holds a name or a number.
    if (action !== 'checkin' && action !== 'uncheckin')
      await audit(c, {
        action: 'update',
        entityType: 'registration',
        entityId: id,
        summaryFr: `Inscription : ${action}`,
        summaryEn: `Registration: ${action}`,
      })
    return c.json({ ok: true })
  })
  .delete('/registrations/:id', requirePermissionAnywhere('registrations:delete'), async (c) => {
    const db = await c.var.deps.db()
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(c, 404, 'not_found')
    const [reg] = await db.select().from(registrations).where(eq(registrations.id, id))
    const form = reg ? await loadForm(db, reg.formId) : undefined
    if (!reg || !form || !(await mayOn(c, 'registrations:delete', form.groupId)))
      return fail(c, 404, 'not_found')
    await db.delete(registrations).where(eq(registrations.id, id))
    if (reg.status === 'confirmed') await promoteWaitlist(db, form)
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'delete',
      entityType: 'registration',
      entityId: id,
      summaryFr: 'Inscription supprimée à la demande de la personne',
      summaryEn: 'Registration deleted on the person’s request',
    })
    return c.json({ ok: true })
  })
  // Check-in on a phone: first names, party size and who is present. No phone number, no answers.
  .get('/forms/:id/checkin', requirePermissionAnywhere('registrations:manage'), async (c) => {
    const db = await c.var.deps.db()
    const f = await loadForm(db, c.req.param('id'))
    if (!f || !(await mayOn(c, 'registrations:manage', f.groupId))) return fail(c, 404, 'not_found')
    const rows = await db
      .select({
        id: registrations.id,
        name: registrations.name,
        partySize: registrations.partySize,
        code: registrations.code,
        checkedInAt: registrations.checkedInAt,
      })
      .from(registrations)
      .where(and(eq(registrations.formId, f.id), eq(registrations.status, 'confirmed')))
      .orderBy(asc(registrations.name))
    const kids = rows.length
      ? await db
          .select()
          .from(registrationPeople)
          .where(
            inArray(
              registrationPeople.registrationId,
              rows.map((r) => r.id),
            ),
          )
      : []
    return c.json({
      title: f.titleFr,
      items: rows.map((r) => ({
        ...r,
        children: kids
          .filter((k) => k.registrationId === r.id)
          .map((k) => ({ id: k.id, firstName: k.firstName, checkedInAt: k.checkedInAt })),
      })),
    })
  })
  // CSV: dangerous (`export`), audited with the number of rows only.
  .get('/forms/:id/export.csv', requirePermissionAnywhere('registrations:export'), async (c) => {
    const db = await c.var.deps.db()
    const f = await loadForm(db, c.req.param('id'))
    if (!f || !(await mayOn(c, 'registrations:export', f.groupId))) return fail(c, 404, 'not_found')
    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.formId, f.id))
      .orderBy(asc(registrations.createdAt), asc(registrations.id))
    const kids = rows.length
      ? await db
          .select()
          .from(registrationPeople)
          .where(
            inArray(
              registrationPeople.registrationId,
              rows.map((r) => r.id),
            ),
          )
      : []
    const head = [
      'Code',
      'Statut',
      'Nom',
      'Téléphone',
      'WhatsApp',
      'E-mail',
      'Personnes',
      'Enfants',
      ...f.fields.map((x) => x.labelFr),
      'Pointé',
      'Inscrit le',
    ]
    const lines = rows.map((r) => [
      r.code,
      r.status,
      r.name,
      r.phone,
      r.whatsapp,
      r.email,
      r.partySize,
      kids
        .filter((k) => k.registrationId === r.id)
        .map((k) => `${k.firstName} (${k.ageBand})`)
        .join('; '),
      ...f.fields.map((x) => {
        const v = r.answers[x.id]
        return Array.isArray(v)
          ? v.join('; ')
          : typeof v === 'boolean'
            ? v
              ? 'oui'
              : 'non'
            : (v ?? '')
      }),
      r.checkedInAt ? 'oui' : '',
      r.createdAt.toISOString(),
    ])
    await audit(c, {
      action: 'export',
      entityType: 'registration_form',
      entityId: f.id,
      summaryFr: `Liste d’inscrits exportée (${rows.length} lignes)`,
      summaryEn: `Registration list exported (${rows.length} rows)`,
      diff: { rows: rows.length },
    })
    c.header('content-type', 'text/csv; charset=utf-8')
    c.header('content-disposition', `attachment; filename="inscrits-${f.slug}.csv"`)
    c.header('cache-control', 'no-store')
    return c.body(`﻿${toCsv([head, ...lines])}`)
  })

/** The anonymous totals of a form (no name, no contact): they outlive the registrations. Also used by the retention job. */
export async function writeCounts(db: Db, f: Pick<Form, 'id' | 'titleFr' | 'eventDate'>) {
  const c = (await counts(db, [f.id])).get(f.id)
  if (!c) return
  await db
    .insert(registrationCounts)
    .values({
      formId: f.id,
      titleFr: f.titleFr,
      eventDate: f.eventDate,
      registered: c.confirmed,
      waitlisted: c.waitlist,
      cancelled: c.cancelled,
      present: c.present,
      recordedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: registrationCounts.formId,
      set: {
        registered: c.confirmed,
        waitlisted: c.waitlist,
        cancelled: c.cancelled,
        present: c.present,
        recordedAt: new Date(),
      },
    })
}
