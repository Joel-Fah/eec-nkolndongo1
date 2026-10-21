/**
 * Settings API, mounted at /api/settings by the registry.
 * - Staff read and save one section at a time (audited, content version bumped).
 * - Changing a value takes away its approval unless the person may approve (settings:validate):
 *   nothing reaches the public site without an explicit approval.
 * - /public is anonymous, edge-cached, and returns approved values only.
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
import { can } from '@eec/auth'
import type { Db } from '@eec/db'
import { inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  publicValues,
  type SectionId,
  type SectionValues,
  sectionSchema,
  sections,
  seeds,
} from './fields.ts'
import { settings } from './schema.ts'

const AREA = 'settings'
const NAMES: Record<SectionId, { fr: string; en: string }> = {
  parish: { fr: 'Paroisse', en: 'Parish' },
  season: { fr: 'Saison liturgique', en: 'Liturgical season' },
}
const ids = Object.keys(sections) as SectionId[]

export async function readSections(db: Db): Promise<Record<SectionId, SectionValues>> {
  const rows = await db.select().from(settings).where(inArray(settings.section, ids))
  const out = structuredClone(seeds)
  for (const row of rows) {
    const id = row.section as SectionId
    out[id] = { ...out[id], ...(row.values as SectionValues) }
  }
  return out
}

export const settingsApi = new Hono<AppEnv>()
  .get('/', requirePermission('settings:read'), async (c) => {
    const db = await c.var.deps.db()
    return c.json({ sections: await readSections(db), fields: sections })
  })

  .put('/:section', requirePermission('settings:edit'), async (c) => {
    const id = c.req.param('section') as SectionId
    if (!ids.includes(id)) return fail(c, 404, 'not_found')
    const parsed = sectionSchema(id).safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 400, 'invalid')
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const mayValidate = can(actor.principal, 'settings:validate')
    const db = await c.var.deps.db()
    const before = (await readSections(db))[id]
    const next: SectionValues = {}
    const diff: Record<string, { from: FieldDiff; to: FieldDiff }> = {}
    for (const [key, field] of Object.entries(parsed.data) as [
      string,
      { value: string; validated: boolean },
    ][]) {
      const old = before[key] ?? { value: '', validated: false }
      const changed = field.value !== old.value
      // Without the right to approve: an edit removes the approval; approval can't be granted.
      const validated = mayValidate ? field.validated : changed ? false : old.validated
      next[key] = { value: field.value, validated: field.value === '' ? false : validated }
      if (changed || next[key].validated !== old.validated) diff[key] = { from: old, to: next[key] }
    }
    if (!Object.keys(diff).length) return c.json({ section: id, values: next, changed: 0 })
    await db
      .insert(settings)
      .values({ section: id, values: next, updatedBy: actor.userId })
      .onConflictDoUpdate({
        target: settings.section,
        set: { values: next, updatedBy: actor.userId },
      })
    await bumpContentVersion(db, AREA)
    await audit(c, {
      action: 'update',
      entityType: 'settings',
      entityId: id,
      summaryFr: `Paramètres « ${NAMES[id].fr} » modifiés (${Object.keys(diff).length} champ(s))`,
      summaryEn: `Settings “${NAMES[id].en}” updated (${Object.keys(diff).length} field(s))`,
      diff,
    })
    return c.json({ section: id, values: next, changed: Object.keys(diff).length })
  })

  // Anonymous and cached: approved values only, for the public site (footer, contact, season).
  .get('/public', async (c) => {
    const db = await c.var.deps.db().catch(() => null)
    const version = db ? await contentVersion(db, AREA).catch(() => 0) : 0
    return cachedJson(c, {
      key: `settings/public/v${version}`,
      ttl: 120,
      keep: 60 * 60 * 24 * 7,
      load: async (fresh) => ({ version, ...publicValues(await readSections(fresh)) }),
    })
  })

type FieldDiff = { value: string; validated: boolean }
