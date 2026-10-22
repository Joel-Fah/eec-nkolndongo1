/** Admin → Système → Santé: the latest stored check, and « Vérifier maintenant ». Nothing here is public. */
import { type AppEnv, requirePermission } from '@eec/api-kit'
import { Hono } from 'hono'
import { latestHealth, runHealth } from '../health.ts'

export const healthRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('core:system-health'), async (c) => {
    const db = await c.var.deps.db()
    const row = await latestHealth(db)
    return c.json({
      latest: row ? { checkedAt: row.checkedAt, status: row.status, checks: row.checks } : null,
    })
  })
  .post('/run', requirePermission('core:system-health'), async (c) => {
    const result = await runHealth(c.env)
    return c.json({ latest: { checkedAt: new Date(), ...result } })
  })
