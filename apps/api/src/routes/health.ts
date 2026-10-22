/** Admin → Système → Santé: the latest stored check, and « Vérifier maintenant ». Nothing here is public. */
import { type AppEnv, requirePermission } from '@eec/api-kit'
import { schema } from '@eec/db'
import { gte } from 'drizzle-orm'
import { Hono } from 'hono'
import { latestHealth, runHealth } from '../health.ts'

/** The last seven days, one row per day (the day's last check), oldest first: for the strips and small charts. */
async function week(db: Awaited<ReturnType<AppEnv['Variables']['deps']['db']>>) {
  const rows = await db
    .select()
    .from(schema.systemHealth)
    .where(gte(schema.systemHealth.checkedAt, new Date(Date.now() - 8 * 86_400_000)))
    .orderBy(schema.systemHealth.checkedAt)
  const byDay = new Map<string, (typeof rows)[number]>()
  for (const r of rows) byDay.set(r.checkedAt.toISOString().slice(0, 10), r)
  return [...byDay.entries()]
    .slice(-7)
    .map(([day, r]) => ({ day, status: r.status, checks: r.checks }))
}

export const healthRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('core:system-health'), async (c) => {
    const db = await c.var.deps.db()
    const row = await latestHealth(db)
    return c.json({
      latest: row ? { checkedAt: row.checkedAt, status: row.status, checks: row.checks } : null,
      history: await week(db),
    })
  })
  .post('/run', requirePermission('core:system-health'), async (c) => {
    const result = await runHealth(c.env)
    const db = await c.var.deps.db()
    return c.json({ latest: { checkedAt: new Date(), ...result }, history: await week(db) })
  })
