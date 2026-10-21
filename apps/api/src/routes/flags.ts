/** Feature flags per module (Phase 02 §6.5): core modules can't be switched off. Toggling is audited. */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { type Db, schema } from '@eec/db'
import { modules } from '@eec/modules'
import { isModuleEnabled } from '@eec/modules-kit'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

export async function readFlags(db: Db): Promise<Map<string, boolean>> {
  const rows = await db.select().from(schema.settingsFlags)
  return new Map(rows.map((r) => [r.moduleId, r.enabled]))
}

export const flagRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('settings:read'), async (c) => {
    const flags = await readFlags(await c.var.deps.db())
    return c.json({
      modules: modules.map((m) => ({
        id: m.id,
        label: m.label,
        toggleable: m.toggleable,
        enabled: isModuleEnabled(m, flags),
      })),
    })
  })

  .put(
    '/:id',
    requirePermission('settings:flags'),
    zValidator('json', z.object({ enabled: z.boolean() })),
    async (c) => {
      const m = modules.find((x) => x.id === c.req.param('id'))
      if (!m) return fail(c, 404, 'not_found')
      if (!m.toggleable) return fail(c, 409, 'not_toggleable')
      const { enabled } = c.req.valid('json')
      const db = await c.var.deps.db()
      const actor = await c.var.deps.actor()
      await db
        .insert(schema.settingsFlags)
        .values({ moduleId: m.id, enabled, updatedBy: actor?.userId ?? null })
        .onConflictDoUpdate({
          target: schema.settingsFlags.moduleId,
          set: { enabled, updatedBy: actor?.userId ?? null },
        })
      await audit(c, {
        action: enabled ? 'module.enable' : 'module.disable',
        entityType: 'module',
        entityId: m.id,
        summaryFr: `Fonctionnalité « ${m.label.fr} » ${enabled ? 'activée' : 'désactivée'}`,
        summaryEn: `Feature “${m.label.en}” turned ${enabled ? 'on' : 'off'}`,
      })
      return c.json({ ok: true })
    },
  )
