import { schema } from '@eec/db'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../context.ts'
import { fail } from '../guards.ts'

export const meRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const actor = await c.var.deps.actor()
  if (!actor) return fail(c, 401, 'unauthenticated')
  const db = await c.var.deps.db()
  const [row] = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      firstName: schema.profiles.firstName,
      lastName: schema.profiles.lastName,
      locale: schema.profiles.locale,
      theme: schema.profiles.theme,
      status: schema.profiles.status,
    })
    .from(schema.user)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
    .where(eq(schema.user.id, actor.userId))
  const p = actor.principal
  return c.json({
    user: row,
    isSuperAdmin: p.isSuperAdmin,
    roles: p.grants.map((g) => ({ role: g.roleKey, groupId: g.groupId })),
    // The UI hides what you can't do; the API remains the authority.
    permissions: p.isSuperAdmin ? ['*'] : [...new Set(p.grants.flatMap((g) => [...g.permissions]))],
  })
})
