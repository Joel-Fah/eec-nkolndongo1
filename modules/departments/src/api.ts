/**
 * Departments API, mounted at /api/departments.
 * - Staff: one page per group. A group leader edits (and publishes, when allowed) only their own group's page.
 *   People shown on a page carry a recorded consent; without it the public sees the role, never the name or photo.
 * - Public (edge-cached): the index with the quiz, and a page by group key.
 */
import {
  type AppEnv,
  audit,
  bumpContentVersion,
  cachedJson,
  fail,
  mayOn,
  requirePermission,
  requirePermissionAnywhere,
  versionFor,
} from '@eec/api-kit'
import { type Principal, scopeFor } from '@eec/auth'
import { cleanDoc, DEFAULT_QUIZ, DEPARTMENT_TAGS, plainText, renderHtml } from '@eec/core'
import type { Db } from '@eec/db'
import { groups, mediaFiles, mediaUsages } from '@eec/db/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { departmentPages, departmentPeople, departmentQuiz } from './schema.ts'

const AREA = 'departments'
const ENTITY = 'department'
const KINDS = ['department', 'committee', 'choir'] as const
const text = (n: number) => z.string().max(n)
const doc = z.custom<unknown>((v) => typeof v === 'object' && v !== null)

export const pageBody = z
  .object({
    taglineFr: text(160),
    taglineEn: text(160),
    bodyFr: doc,
    bodyEn: doc,
    coverMediaId: z.string().uuid().nullable(),
    meetingFr: text(400),
    meetingEn: text(400),
    contactWhatsapp: text(200),
    contactPhone: text(40),
    tags: z.array(z.enum(DEPARTMENT_TAGS)).max(DEPARTMENT_TAGS.length),
    sortOrder: z.number().int().min(0).max(999),
  })
  .partial()
  .strict()

export const personBody = z
  .object({
    name: text(120).min(1),
    userId: z.string().uuid().nullable(),
    roleFr: text(120),
    roleEn: text(120),
    photoMediaId: z.string().uuid().nullable(),
    publicConsent: z.boolean(),
    sortOrder: z.number().int().min(0).max(999),
  })
  .partial()
  .strict()

const answer = z.object({
  id: z.string().min(1).max(20),
  textFr: text(140).min(1),
  textEn: text(140),
  tags: z.array(z.enum(DEPARTMENT_TAGS)).min(1).max(4),
})
export const quizBody = z
  .object({
    questions: z
      .array(
        z.object({
          id: z.string().min(1).max(20),
          textFr: text(140).min(1),
          textEn: text(140),
          answers: z.array(answer).min(2).max(6),
        }),
      )
      .min(1)
      .max(5),
  })
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

type PageRow = typeof departmentPages.$inferSelect
type PersonRow = typeof departmentPeople.$inferSelect

async function syncUsages(db: Db, page: PageRow, people: PersonRow[]) {
  const used = [
    ...(page.coverMediaId ? [{ id: page.coverMediaId, field: 'cover' }] : []),
    ...people
      .filter((p) => p.photoMediaId)
      .map((p) => ({ id: p.photoMediaId as string, field: `person:${p.id}` })),
  ]
  await db
    .delete(mediaUsages)
    .where(and(eq(mediaUsages.entityType, ENTITY), eq(mediaUsages.entityId, page.id)))
  if (!used.length) return
  const existing = await db
    .select({ id: mediaFiles.id })
    .from(mediaFiles)
    .where(
      inArray(
        mediaFiles.id,
        used.map((u) => u.id),
      ),
    )
  const ok = new Set(existing.map((e) => e.id))
  const rows = used.filter((u) => ok.has(u.id))
  if (rows.length)
    await db
      .insert(mediaUsages)
      .values(
        rows.map((u) => ({ mediaId: u.id, entityType: ENTITY, entityId: page.id, field: u.field })),
      )
}

async function quizOf(db: Db) {
  const [row] = await db
    .select()
    .from(departmentQuiz)
    .where(eq(departmentQuiz.key, 'main'))
    .limit(1)
  const parsed = quizBody.safeParse(row?.data)
  return parsed.success ? parsed.data : DEFAULT_QUIZ
}

async function publicIndex(db: Db, locale: Locale) {
  const rows = await db
    .select({ page: departmentPages, group: groups })
    .from(departmentPages)
    .innerJoin(groups, eq(groups.id, departmentPages.groupId))
    .where(and(eq(departmentPages.state, 'published'), eq(groups.isActive, true)))
    .orderBy(asc(departmentPages.sortOrder), asc(groups.nameFr))
  const ids = rows.map((r) => r.page.coverMediaId).filter((x): x is string => !!x)
  const media = ids.length
    ? await db.select().from(mediaFiles).where(inArray(mediaFiles.id, ids))
    : []
  return {
    items: rows.map(({ page, group }) => ({
      key: group.key,
      kind: group.kind,
      name: pick(locale, group.nameFr, group.nameEn ?? ''),
      tagline: pick(locale, page.taglineFr, page.taglineEn),
      fallback: locale === 'en' && !page.taglineEn.trim(),
      tags: page.tags,
      cover: mediaOut(media.find((m) => m.id === page.coverMediaId)),
    })),
    quiz: await quizOf(db),
  }
}

async function publicPage(db: Db, key: string, locale: Locale) {
  const [row] = await db
    .select({ page: departmentPages, group: groups })
    .from(departmentPages)
    .innerJoin(groups, eq(groups.id, departmentPages.groupId))
    .where(
      and(eq(groups.key, key), eq(departmentPages.state, 'published'), eq(groups.isActive, true)),
    )
    .limit(1)
  if (!row) return null
  const { page, group } = row
  const people = await db
    .select()
    .from(departmentPeople)
    .where(eq(departmentPeople.pageId, page.id))
    .orderBy(asc(departmentPeople.sortOrder), asc(departmentPeople.name))
  const mediaIds = [
    page.coverMediaId,
    ...people.filter((p) => p.publicConsent).map((p) => p.photoMediaId),
  ].filter((x): x is string => !!x)
  const media = mediaIds.length
    ? await db.select().from(mediaFiles).where(inArray(mediaFiles.id, mediaIds))
    : []
  const en = locale === 'en' && plainText(page.bodyEn).trim() !== ''
  return {
    key: group.key,
    groupId: group.id,
    kind: group.kind,
    name: pick(locale, group.nameFr, group.nameEn ?? ''),
    tagline: pick(locale, page.taglineFr, page.taglineEn),
    fallback: locale === 'en' && !en,
    html: renderHtml(cleanDoc(en ? page.bodyEn : page.bodyFr)),
    meeting: pick(locale, page.meetingFr, page.meetingEn),
    contact: { whatsapp: page.contactWhatsapp, phone: page.contactPhone },
    tags: page.tags,
    cover: mediaOut(media.find((m) => m.id === page.coverMediaId)),
    // Without a recorded consent, only the role is shown: no name, no photo.
    people: people.map((p) => ({
      role: pick(locale, p.roleFr, p.roleEn),
      name: p.publicConsent ? p.name : null,
      photo: p.publicConsent ? mediaOut(media.find((m) => m.id === p.photoMediaId)) : null,
    })),
  }
}

/** The group row for an admin route, with the check that this person may act on it. */
async function groupFor(c: Parameters<typeof mayOn>[0], groupId: string, permission: string) {
  if (!/^[0-9a-f-]{36}$/.test(groupId)) return { error: fail(c, 404, 'not_found') as Response }
  const db = await c.var.deps.db()
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1)
  if (!group || !(KINDS as readonly string[]).includes(group.kind))
    return { error: fail(c, 404, 'not_found') as Response }
  if (!(await mayOn(c, permission, groupId)))
    return { error: fail(c, 403, 'forbidden') as Response }
  return { db, group }
}

async function pageOf(db: Db, groupId: string) {
  const [row] = await db
    .select()
    .from(departmentPages)
    .where(eq(departmentPages.groupId, groupId))
    .limit(1)
  return row ?? null
}

export const departmentsApi = new Hono<AppEnv>()
  // ——— Public ————————————————————————————————————————————————
  .get('/public', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `departments/list/${locale}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: (db) => publicIndex(db, locale),
    })
  })
  .get('/public/item/:key', async (c) => {
    const locale = localeOf(c.req.query('locale'))
    const key = c.req.param('key')
    if (!/^[a-z0-9-]{1,60}$/.test(key)) return fail(c, 404, 'not_found')
    const version = await versionFor(c.var.deps.db, AREA, c.var.deps.timeoutMs)
    return cachedJson(c, {
      key: `departments/item/${locale}/${key}/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (db) => ({ page: await publicPage(db, key, locale) }),
    })
  })

  // ——— Staff ————————————————————————————————————————————————
  .get('/', requirePermissionAnywhere('departments:read'), async (c) => {
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    const scope = scopeFor(actor?.principal as Principal, 'departments:read')
    const all = await db
      .select()
      .from(groups)
      .where(inArray(groups.kind, [...KINDS]))
      .orderBy(asc(groups.nameFr))
    const pages = await db.select().from(departmentPages)
    return c.json({
      items: all
        .filter((g) => scope === 'all' || scope.includes(g.id))
        .map((g) => {
          const p = pages.find((x) => x.groupId === g.id)
          return {
            groupId: g.id,
            key: g.key,
            nameFr: g.nameFr,
            nameEn: g.nameEn,
            kind: g.kind,
            active: g.isActive,
            state: p?.state ?? 'none',
            updatedAt: p?.updatedAt ?? null,
          }
        }),
    })
  })
  .get('/quiz', requirePermissionAnywhere('departments:read'), async (c) =>
    c.json({ quiz: await quizOf(await c.var.deps.db()) }),
  )
  .put('/quiz', requirePermission('departments:quiz'), async (c) => {
    const parsed = quizBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    await db
      .insert(departmentQuiz)
      .values({ key: 'main', data: parsed.data, updatedBy: actor?.userId })
      .onConflictDoUpdate({
        target: departmentQuiz.key,
        set: { data: parsed.data, updatedBy: actor?.userId, updatedAt: new Date() },
      })
    await audit(c, {
      action: 'update',
      entityType: 'department_quiz',
      entityId: 'main',
      summaryFr: 'Questionnaire « Où est ta place ? » modifié',
      summaryEn: '“Where do you belong?” quiz edited',
    })
    await bumpContentVersion(db, AREA)
    return c.json({ ok: true })
  })
  .get('/:groupId', requirePermissionAnywhere('departments:read'), async (c) => {
    const r = await groupFor(c, c.req.param('groupId'), 'departments:read')
    if (r.error) return r.error
    const page = await pageOf(r.db, r.group.id)
    const people = page
      ? await r.db
          .select()
          .from(departmentPeople)
          .where(eq(departmentPeople.pageId, page.id))
          .orderBy(asc(departmentPeople.sortOrder), asc(departmentPeople.name))
      : []
    return c.json({ group: r.group, page, people })
  })
  .put(
    '/:groupId',
    requirePermission('departments:update', { group: (c) => c.req.param('groupId') }),
    async (c) => {
      const parsed = pageBody.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) return fail(c, 400, 'invalid')
      const r = await groupFor(c, c.req.param('groupId'), 'departments:update')
      if (r.error) return r.error
      const p = parsed.data
      const actor = await c.var.deps.actor()
      const set = {
        ...(p.taglineFr !== undefined && { taglineFr: p.taglineFr }),
        ...(p.taglineEn !== undefined && { taglineEn: p.taglineEn }),
        ...(p.bodyFr !== undefined && { bodyFr: cleanDoc(p.bodyFr) }),
        ...(p.bodyEn !== undefined && { bodyEn: cleanDoc(p.bodyEn) }),
        ...(p.coverMediaId !== undefined && { coverMediaId: p.coverMediaId }),
        ...(p.meetingFr !== undefined && { meetingFr: p.meetingFr }),
        ...(p.meetingEn !== undefined && { meetingEn: p.meetingEn }),
        ...(p.contactWhatsapp !== undefined && { contactWhatsapp: p.contactWhatsapp }),
        ...(p.contactPhone !== undefined && { contactPhone: p.contactPhone }),
        ...(p.tags !== undefined && { tags: p.tags }),
        ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
        updatedBy: actor?.userId,
        updatedAt: new Date(),
      }
      const [row] = await r.db
        .insert(departmentPages)
        .values({ groupId: r.group.id, ...set })
        .onConflictDoUpdate({ target: departmentPages.groupId, set })
        .returning()
      if (!row) return fail(c, 400, 'invalid')
      const people = await r.db
        .select()
        .from(departmentPeople)
        .where(eq(departmentPeople.pageId, row.id))
      await syncUsages(r.db, row, people)
      await audit(c, {
        action: 'update',
        entityType: ENTITY,
        entityId: row.id,
        summaryFr: `Page du groupe « ${r.group.nameFr} » modifiée`,
        summaryEn: `Group page “${r.group.nameFr}” edited`,
      })
      if (row.state === 'published') await bumpContentVersion(r.db, AREA)
      return c.json({ page: row })
    },
  )
  .post(
    '/:groupId/publish',
    requirePermission('departments:publish', { group: (c) => c.req.param('groupId') }),
    async (c) => {
      return setState(c, 'published')
    },
  )
  .post(
    '/:groupId/unpublish',
    requirePermission('departments:publish', { group: (c) => c.req.param('groupId') }),
    async (c) => {
      return setState(c, 'draft')
    },
  )
  .post(
    '/:groupId/people',
    requirePermission('departments:update', { group: (c) => c.req.param('groupId') }),
    async (c) => {
      const parsed = personBody.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success || !parsed.data.name) return fail(c, 400, 'invalid')
      const r = await groupFor(c, c.req.param('groupId'), 'departments:update')
      if (r.error) return r.error
      const page = await pageOf(r.db, r.group.id)
      if (!page) return fail(c, 400, 'invalid') // save the page first
      const p = parsed.data
      const actor = await c.var.deps.actor()
      const [row] = await r.db
        .insert(departmentPeople)
        .values({
          pageId: page.id,
          name: p.name as string,
          userId: p.userId ?? null,
          roleFr: p.roleFr ?? '',
          roleEn: p.roleEn ?? '',
          photoMediaId: p.photoMediaId ?? null,
          publicConsent: p.publicConsent ?? false,
          consentBy: p.publicConsent ? actor?.userId : null,
          consentAt: p.publicConsent ? new Date() : null,
          sortOrder: p.sortOrder ?? 0,
        })
        .returning()
      if (!row) return fail(c, 400, 'invalid')
      await afterPeopleChange(c, r.db, page, 'add', row)
      return c.json({ person: row })
    },
  )
  .put(
    '/:groupId/people/:personId',
    requirePermission('departments:update', { group: (c) => c.req.param('groupId') }),
    async (c) => {
      const parsed = personBody.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) return fail(c, 400, 'invalid')
      const r = await groupFor(c, c.req.param('groupId'), 'departments:update')
      if (r.error) return r.error
      const page = await pageOf(r.db, r.group.id)
      const [old] = page
        ? await r.db
            .select()
            .from(departmentPeople)
            .where(
              and(
                eq(departmentPeople.id, c.req.param('personId')),
                eq(departmentPeople.pageId, page.id),
              ),
            )
            .limit(1)
        : []
      if (!page || !old) return fail(c, 404, 'not_found')
      const p = parsed.data
      const actor = await c.var.deps.actor()
      // Consent is recorded when it is given (who, when) and cleared when it is withdrawn.
      const consent =
        p.publicConsent === undefined || p.publicConsent === old.publicConsent
          ? {}
          : p.publicConsent
            ? { publicConsent: true, consentBy: actor?.userId, consentAt: new Date() }
            : { publicConsent: false, consentBy: null, consentAt: null }
      const [row] = await r.db
        .update(departmentPeople)
        .set({
          ...(p.name !== undefined && { name: p.name }),
          ...(p.userId !== undefined && { userId: p.userId }),
          ...(p.roleFr !== undefined && { roleFr: p.roleFr }),
          ...(p.roleEn !== undefined && { roleEn: p.roleEn }),
          ...(p.photoMediaId !== undefined && { photoMediaId: p.photoMediaId }),
          ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
          ...consent,
          updatedAt: new Date(),
        })
        .where(eq(departmentPeople.id, old.id))
        .returning()
      if (!row) return fail(c, 404, 'not_found')
      await afterPeopleChange(c, r.db, page, 'edit', row, 'publicConsent' in consent)
      return c.json({ person: row })
    },
  )
  .delete(
    '/:groupId/people/:personId',
    requirePermission('departments:update', { group: (c) => c.req.param('groupId') }),
    async (c) => {
      const r = await groupFor(c, c.req.param('groupId'), 'departments:update')
      if (r.error) return r.error
      const page = await pageOf(r.db, r.group.id)
      const [old] = page
        ? await r.db
            .select()
            .from(departmentPeople)
            .where(
              and(
                eq(departmentPeople.id, c.req.param('personId')),
                eq(departmentPeople.pageId, page.id),
              ),
            )
            .limit(1)
        : []
      if (!page || !old) return fail(c, 404, 'not_found')
      await r.db.delete(departmentPeople).where(eq(departmentPeople.id, old.id))
      await afterPeopleChange(c, r.db, page, 'remove', old)
      return c.json({ ok: true })
    },
  )

async function setState(c: Parameters<typeof mayOn>[0], state: 'published' | 'draft') {
  const r = await groupFor(c, c.req.param('groupId') ?? '', 'departments:publish')
  if (r.error) return r.error
  const page = await pageOf(r.db, r.group.id)
  if (!page) return fail(c, 400, 'invalid')
  if (state === 'published' && !page.taglineFr.trim() && !plainText(page.bodyFr).trim())
    return fail(c, 400, 'invalid') // nothing to show yet
  await r.db
    .update(departmentPages)
    .set({ state, updatedAt: new Date() })
    .where(eq(departmentPages.id, page.id))
  await audit(c, {
    action: state === 'published' ? 'publish' : 'unpublish',
    entityType: ENTITY,
    entityId: page.id,
    summaryFr:
      state === 'published'
        ? `Page du groupe « ${r.group.nameFr} » publiée`
        : `Page du groupe « ${r.group.nameFr} » retirée du site`,
    summaryEn:
      state === 'published'
        ? `Group page “${r.group.nameFr}” published`
        : `Group page “${r.group.nameFr}” taken off the site`,
  })
  await bumpContentVersion(r.db, AREA)
  return c.json({ ok: true, state })
}

async function afterPeopleChange(
  c: Parameters<typeof mayOn>[0],
  db: Db,
  page: PageRow,
  what: 'add' | 'edit' | 'remove',
  person: PersonRow,
  consentChanged = what === 'add' && person.publicConsent,
) {
  const people = await db
    .select()
    .from(departmentPeople)
    .where(eq(departmentPeople.pageId, page.id))
  await syncUsages(db, page, people)
  // Consent is the sensitive part: it gets its own line in the audit trail, with who recorded it.
  await audit(c, {
    action: 'update',
    entityType: 'department_person',
    entityId: person.id,
    summaryFr: consentChanged
      ? person.publicConsent
        ? 'Consentement de publication du nom enregistré'
        : 'Consentement de publication du nom retiré'
      : what === 'remove'
        ? 'Personne retirée d’une page de groupe'
        : 'Personne modifiée sur une page de groupe',
    summaryEn: consentChanged
      ? person.publicConsent
        ? 'Consent to publish the name recorded'
        : 'Consent to publish the name withdrawn'
      : what === 'remove'
        ? 'Person removed from a group page'
        : 'Person edited on a group page',
  })
  if (page.state === 'published') await bumpContentVersion(db, AREA)
}
