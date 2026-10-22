/** Admin → Tableau de bord / Visites: what the visit counter saw in the last 30 days (decision 0038). Aggregates only. */
import { type AppEnv, requirePermission } from '@eec/api-kit'
import { Hono } from 'hono'
import { readVisits } from '../visits.ts'

export const visitsRoutes = new Hono<AppEnv>().get(
  '/',
  requirePermission('core:visits-read'),
  async (c) => {
    const stats = await readVisits(c.env).catch(() => null)
    return c.json(stats ?? { configured: false })
  },
)
