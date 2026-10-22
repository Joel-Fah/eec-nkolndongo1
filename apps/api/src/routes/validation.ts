/**
 * « À valider »: the live, permission-filtered list of content waiting for the content partner, with the means to approve
 * it or to ask for a correction. It reads the modules' tables by name (a roll-up across modules, like « À faire »), and
 * `scripts/content-pending.ts` stays the offline version of the same idea. Nothing here is public.
 *
 * What can be approved here: settings fields (settings:validate), schedule slots (schedule:validate), page texts and home
 * figures (story:publish — publishing a text IS its validation, decision 0039). Anything else is listed in the tracker.
 */
import { type AppEnv, audit, bumpContentVersion, fail, requirePermission } from '@eec/api-kit'
import { can, canAnywhere, type Principal } from '@eec/auth'
import { PAGE_SLOTS } from '@eec/core'
import { contentReviews, user } from '@eec/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

type Kind = 'settings' | 'schedule' | 'page_slot'
type Item = {
  id: string
  kind: Kind
  /** Where it lives in the admin, and (when it has one) the public page showing it. */
  group: { fr: string; en: string }
  /** settings: the field key (translated by the admin); others: a ready label. */
  fieldKey?: string
  label?: { fr: string; en: string }
  value: string
  adminPath: string
  publicPath: { fr: string; en: string } | null
  canApprove: boolean
}

const SECTION_NAMES: Record<string, { fr: string; en: string }> = {
  parish: { fr: 'Paramètres · Paroisse', en: 'Settings · Parish' },
  season: { fr: 'Paramètres · Saison', en: 'Settings · Season' },
  giving: { fr: 'Paramètres · Donner', en: 'Settings · Give' },
}
const SECTION_PAGES: Record<string, { fr: string; en: string } | null> = {
  parish: { fr: 'fr/decouvrir/nous-trouver/', en: 'en/discover/find-us/' },
  season: null,
  giving: { fr: 'fr/donner/', en: 'en/give/' },
}
const itemId = /^(settings|schedule|page_slot):[\w.-]{1,80}$/
const body = z.object({ id: z.string().regex(itemId) }).strict()
const commentBody = z
  .object({
    id: z.string().regex(itemId),
    kind: z.enum(['correction', 'note']),
    body: z.string().trim().min(2).max(600),
  })
  .strict()

const split = (id: string) => {
  const i = id.indexOf(':')
  return [id.slice(0, i) as Kind, id.slice(i + 1)] as const
}

async function pending(c: import('hono').Context<AppEnv>) {
  const actor = await c.var.deps.actor()
  const p = actor?.principal as Principal
  const db = await c.var.deps.db()
  const items: Item[] = []

  if (canAnywhere(p, 'settings:read') || canAnywhere(p, 'settings:validate')) {
    const rows = (
      await db.execute<{ section: string; k: string; v: string }>(
        sql`select section, k, v->>'value' as v from settings, jsonb_each(values) as e(k, v)
            where v->>'value' <> '' and coalesce((v->>'validated')::boolean, false) = false order by section, k`,
      )
    ).rows
    for (const r of rows)
      items.push({
        id: `settings:${r.section}.${r.k}`,
        kind: 'settings',
        group: SECTION_NAMES[r.section] ?? { fr: r.section, en: r.section },
        fieldKey: r.k,
        value: r.v,
        adminPath: '/m/settings',
        publicPath: SECTION_PAGES[r.section] ?? null,
        canApprove: can(p, 'settings:validate'),
      })
  }
  if (canAnywhere(p, 'schedule:read') || canAnywhere(p, 'schedule:validate')) {
    const rows = (
      await db.execute<{
        id: string
        label_fr: string
        label_en: string
        weekday: number
        start_time: string
        place_fr: string
      }>(
        sql`select id, label_fr, label_en, weekday, start_time, place_fr from schedule_slots where validated = false order by weekday, start_time`,
      )
    ).rows
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    for (const r of rows)
      items.push({
        id: `schedule:${r.id}`,
        kind: 'schedule',
        group: { fr: 'Cultes et horaires', en: 'Services and times' },
        label: { fr: r.label_fr, en: r.label_en || r.label_fr },
        value: `${days[r.weekday]} ${r.start_time}${r.place_fr ? ` · ${r.place_fr}` : ''}`,
        adminPath: '/m/schedule',
        publicPath: { fr: 'fr/vivre/cultes-et-horaires/', en: 'en/live/services-and-times/' },
        canApprove: can(p, 'schedule:validate'),
      })
  }
  if (canAnywhere(p, 'story:read')) {
    const rows = (
      await db.execute<{ page_key: string; slot_key: string; v: string; b: string }>(
        sql`select page_key, slot_key, value_fr as v, body_fr::text as b from page_slots where state = 'draft' order by page_key, slot_key`,
      )
    ).rows
    for (const r of rows) {
      const page = PAGE_SLOTS[r.page_key]
      const def = page?.slots.find((s) => s.key === r.slot_key)
      if (!page || !def) continue
      const text = def.type === 'rich' ? (r.b.includes('"text"') ? '…' : '') : r.v
      if (!text.trim()) continue
      items.push({
        id: `page_slot:${r.page_key}.${r.slot_key}`,
        kind: 'page_slot',
        group: page.label,
        label: def.label,
        value: def.type === 'rich' ? '(texte mis en forme)' : text,
        adminPath: '/m/story',
        publicPath: page.path,
        canApprove: can(p, 'story:publish'),
      })
    }
  }
  const reviews = await db
    .select({ r: contentReviews, author: user.name })
    .from(contentReviews)
    .leftJoin(user, eq(user.id, contentReviews.createdBy))
    .where(eq(contentReviews.status, 'open'))
    .orderBy(desc(contentReviews.createdAt))
  return {
    items: items.map((i) => ({
      ...i,
      reviews: reviews
        .filter((x) => `${x.r.itemKind}:${x.r.itemRef}` === i.id)
        .map((x) => ({
          id: x.r.id,
          kind: x.r.kind,
          body: x.r.body,
          author: x.author,
          createdAt: x.r.createdAt,
        })),
    })),
  }
}

export const validationRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('core:validation-read'), async (c) => c.json(await pending(c)))
  .get('/count', requirePermission('core:validation-read'), async (c) => {
    const { items } = await pending(c)
    return c.json({ n: items.length, canApprove: items.filter((i) => i.canApprove).length })
  })
  .post('/approve', requirePermission('core:validation-read'), async (c) => {
    const parsed = body.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const p = actor.principal as Principal
    const db = await c.var.deps.db()
    const [kind, ref] = split(parsed.data.id)
    if (kind === 'settings') {
      if (!can(p, 'settings:validate')) return fail(c, 403, 'forbidden')
      const [section, key] = ref.split('.')
      if (!section || !key || !SECTION_NAMES[section]) return fail(c, 400, 'invalid')
      const res = await db.execute(
        sql`update settings set values = jsonb_set(values, ${`{${key},validated}`}::text[], 'true'::jsonb), updated_by = ${actor.userId}, updated_at = now()
            where section = ${section} and values->${key}->>'value' <> ''`,
      )
      if (!res.rowCount) return fail(c, 404, 'not_found')
      await bumpContentVersion(db, 'settings')
    } else if (kind === 'schedule') {
      if (!can(p, 'schedule:validate')) return fail(c, 403, 'forbidden')
      const res = await db.execute(
        sql`update schedule_slots set validated = true, validated_by = ${actor.userId}, validated_at = now() where id = ${ref}::uuid`,
      )
      if (!res.rowCount) return fail(c, 404, 'not_found')
      await bumpContentVersion(db, 'schedule')
    } else {
      if (!can(p, 'story:publish')) return fail(c, 403, 'forbidden')
      const [page, slot] = ref.split('.')
      const res = await db.execute(
        sql`update page_slots set state = 'published', updated_by = ${actor.userId}, updated_at = now() where page_key = ${page} and slot_key = ${slot}`,
      )
      if (!res.rowCount) return fail(c, 404, 'not_found')
      await bumpContentVersion(db, 'story')
    }
    // Resolve the open corrections: they were answered by the approval.
    await db
      .update(contentReviews)
      .set({ status: 'resolved', resolvedAt: new Date(), resolvedBy: actor.userId })
      .where(
        and(
          eq(contentReviews.itemKind, kind),
          eq(contentReviews.itemRef, ref),
          eq(contentReviews.status, 'open'),
        ),
      )
    await audit(c, {
      action: 'update',
      entityType: 'validation',
      entityId: parsed.data.id,
      summaryFr: 'Contenu validé pour le site public',
      summaryEn: 'Content validated for the public site',
    })
    return c.json({ ok: true })
  })
  .post('/comment', requirePermission('core:validation-comment'), async (c) => {
    const parsed = commentBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const actor = await c.var.deps.actor()
    const db = await c.var.deps.db()
    const [kind, ref] = split(parsed.data.id)
    const [row] = await db
      .insert(contentReviews)
      .values({
        itemKind: kind,
        itemRef: ref,
        kind: parsed.data.kind,
        body: parsed.data.body,
        createdBy: actor?.userId,
      })
      .returning({ id: contentReviews.id })
    await audit(c, {
      action: 'create',
      entityType: 'content_review',
      entityId: row?.id ?? parsed.data.id,
      // The comment itself stays in its table; the log says only what happened.
      summaryFr:
        parsed.data.kind === 'correction'
          ? 'Correction demandée sur un contenu'
          : 'Remarque laissée sur un contenu',
      summaryEn:
        parsed.data.kind === 'correction'
          ? 'Correction requested on content'
          : 'Note left on content',
    })
    return c.json({ ok: true })
  })
  .post('/reviews/:id/resolve', requirePermission('core:validation-comment'), async (c) => {
    const actor = await c.var.deps.actor()
    const db = await c.var.deps.db()
    const res = await db
      .update(contentReviews)
      .set({ status: 'resolved', resolvedAt: new Date(), resolvedBy: actor?.userId })
      .where(and(eq(contentReviews.id, c.req.param('id')), eq(contentReviews.status, 'open')))
      .returning({ id: contentReviews.id })
    if (!res.length) return fail(c, 404, 'not_found')
    return c.json({ ok: true })
  })
