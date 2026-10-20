/**
 * Departments, committees and choirs. Membership is not permission: leaders are the people holding
 * « Responsable de groupe » scoped to the group. Groups are deactivated, never deleted (history stays).
 */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { slugify } from '@eec/core'
import { type Db, schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, asc, count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const { groups, groupMembers, userRoles, roles, user } = schema

const body = z.object({
  nameFr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().max(80).optional().default(''),
  kind: z.enum(['department', 'committee', 'choir', 'other']),
  descriptionFr: z.string().trim().max(400).optional().default(''),
  descriptionEn: z.string().trim().max(400).optional().default(''),
  isActive: z.boolean().optional().default(true),
})

async function uniqueKey(db: Db, name: string) {
  const base = slugify(name) || 'groupe'
  for (let i = 0; ; i++) {
    const key = i ? `${base}-${i + 1}` : base
    const [hit] = await db.select({ id: groups.id }).from(groups).where(eq(groups.key, key))
    if (!hit) return key
  }
}

const leadersOf = (db: Db) =>
  db
    .select({ groupId: userRoles.groupId, userId: user.id, name: user.name, email: user.email })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(user, eq(user.id, userRoles.userId))
    .where(eq(roles.key, 'responsable-groupe'))

export const groupRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('core:groups-read'), async (c) => {
    const db = await c.var.deps.db()
    const [list, counts, leaders] = await Promise.all([
      db.select().from(groups).orderBy(asc(groups.nameFr)),
      db
        .select({ groupId: groupMembers.groupId, n: count() })
        .from(groupMembers)
        .groupBy(groupMembers.groupId),
      leadersOf(db),
    ])
    return c.json({
      groups: list.map((g) => ({
        ...g,
        members: counts.find((x) => x.groupId === g.id)?.n ?? 0,
        leaders: leaders.filter((l) => l.groupId === g.id),
      })),
    })
  })

  .get('/:id', requirePermission('core:groups-read'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const [group] = await db.select().from(groups).where(eq(groups.id, id))
    if (!group) return fail(c, 404, 'not_found')
    const [members, leaders] = await Promise.all([
      db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          titleFr: groupMembers.titleFr,
        })
        .from(groupMembers)
        .innerJoin(user, eq(user.id, groupMembers.userId))
        .where(eq(groupMembers.groupId, id))
        .orderBy(asc(user.name)),
      leadersOf(db).then((rows) => rows.filter((r) => r.groupId === id)),
    ])
    return c.json({ group, members, leaders })
  })

  .post('/', requirePermission('core:groups-manage'), zValidator('json', body), async (c) => {
    const b = c.req.valid('json')
    const db = await c.var.deps.db()
    const [group] = await db
      .insert(groups)
      .values({
        key: await uniqueKey(db, b.nameFr),
        nameFr: b.nameFr,
        nameEn: b.nameEn || null,
        kind: b.kind,
        descriptionFr: b.descriptionFr || null,
        descriptionEn: b.descriptionEn || null,
        isActive: b.isActive,
      })
      .returning()
    if (!group) return fail(c, 400, 'invalid')
    await audit(c, {
      action: 'group.create',
      entityType: 'group',
      entityId: group.id,
      summaryFr: `Groupe « ${group.nameFr} » créé`,
      summaryEn: `Group “${group.nameEn ?? group.nameFr}” created`,
      diff: b,
    })
    return c.json({ id: group.id }, 201)
  })

  .put('/:id', requirePermission('core:groups-manage'), zValidator('json', body), async (c) => {
    const id = c.req.param('id')
    const b = c.req.valid('json')
    const db = await c.var.deps.db()
    const [before] = await db.select().from(groups).where(eq(groups.id, id))
    if (!before) return fail(c, 404, 'not_found')
    await db
      .update(groups)
      .set({
        nameFr: b.nameFr,
        nameEn: b.nameEn || null,
        kind: b.kind,
        descriptionFr: b.descriptionFr || null,
        descriptionEn: b.descriptionEn || null,
        isActive: b.isActive,
      })
      .where(and(eq(groups.id, id)))
    await audit(c, {
      action:
        b.isActive === before.isActive
          ? 'group.update'
          : b.isActive
            ? 'group.reactivate'
            : 'group.deactivate',
      entityType: 'group',
      entityId: id,
      summaryFr: `Groupe « ${b.nameFr} » modifié`,
      summaryEn: `Group “${b.nameEn || b.nameFr}” updated`,
      diff: {
        before: { nameFr: before.nameFr, kind: before.kind, isActive: before.isActive },
        after: b,
      },
    })
    return c.json({ ok: true })
  })
