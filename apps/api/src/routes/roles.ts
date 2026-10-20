/**
 * Roles and their rights (« droits d'accès » in the UI). System roles can't be deleted; Super admin's rights
 * can't be edited (it implicitly has everything). Deprecated permissions are hidden from the matrix.
 */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { slugify } from '@eec/core'
import { type Db, schema } from '@eec/db'
import { moduleById } from '@eec/modules'
import { zValidator } from '@hono/zod-validator'
import { and, asc, count, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const { roles, rolePermissions, permissions, userRoles } = schema

const body = z.object({
  nameFr: z.string().trim().min(2).max(60),
  nameEn: z.string().trim().max(60).optional().default(''),
  descriptionFr: z.string().trim().max(300).optional().default(''),
  descriptionEn: z.string().trim().max(300).optional().default(''),
  permissions: z.array(z.string().max(80)).max(300),
})

async function permsOf(db: Db, roleId: string) {
  const rows = await db
    .select({ key: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId))
  return rows.map((r) => r.key)
}

async function setPerms(db: Db, roleId: string, keys: string[]) {
  const known = keys.length
    ? (
        await db
          .select({ key: permissions.key })
          .from(permissions)
          .where(and(inArray(permissions.key, keys), eq(permissions.deprecated, false)))
      ).map((r) => r.key)
    : []
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
  if (known.length)
    await db.insert(rolePermissions).values(known.map((k) => ({ roleId, permissionKey: k })))
  return known
}

async function uniqueKey(db: Db, name: string) {
  const base = slugify(name) || 'role'
  for (let i = 0; ; i++) {
    const key = i ? `${base}-${i + 1}` : base
    const [hit] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key))
    if (!hit) return key
  }
}

export const roleRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('core:roles-read'), async (c) => {
    const db = await c.var.deps.db()
    const [list, grants, counts] = await Promise.all([
      db.select().from(roles).orderBy(asc(roles.isSystem), asc(roles.nameFr)),
      db.select().from(rolePermissions),
      db
        .select({ roleId: userRoles.roleId, users: count() })
        .from(userRoles)
        .groupBy(userRoles.roleId),
    ])
    return c.json({
      roles: list.map((r) => ({
        ...r,
        permissions: grants.filter((g) => g.roleId === r.id).map((g) => g.permissionKey),
        users: counts.find((x) => x.roleId === r.id)?.users ?? 0,
      })),
    })
  })

  // The matrix: every live permission, grouped by module, with readable labels.
  .get('/permissions', requirePermission('core:roles-read'), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select()
      .from(permissions)
      .where(eq(permissions.deprecated, false))
      .orderBy(asc(permissions.module), asc(permissions.key))
    const byModule = new Map<string, typeof rows>()
    for (const p of rows) byModule.set(p.module, [...(byModule.get(p.module) ?? []), p])
    return c.json({
      modules: [...byModule].map(([id, perms]) => ({
        id,
        label: moduleById(id)?.label ?? { fr: id, en: id },
        permissions: perms.map((p) => ({
          key: p.key,
          labelFr: p.labelFr,
          labelEn: p.labelEn,
          descriptionFr: p.descriptionFr,
          descriptionEn: p.descriptionEn,
          dangerous: p.isDangerous,
        })),
      })),
    })
  })

  .post('/', requirePermission('core:roles-manage'), zValidator('json', body), async (c) => {
    const b = c.req.valid('json')
    const db = await c.var.deps.db()
    const [role] = await db
      .insert(roles)
      .values({
        key: await uniqueKey(db, b.nameFr),
        nameFr: b.nameFr,
        nameEn: b.nameEn || null,
        descriptionFr: b.descriptionFr || null,
        descriptionEn: b.descriptionEn || null,
      })
      .returning()
    if (!role) return fail(c, 400, 'invalid')
    const granted = await setPerms(db, role.id, b.permissions)
    await audit(c, {
      action: 'role.create',
      entityType: 'role',
      entityId: role.id,
      summaryFr: `Rôle « ${role.nameFr} » créé (${granted.length} droit(s))`,
      summaryEn: `Role “${role.nameEn ?? role.nameFr}” created (${granted.length} right(s))`,
      diff: { permissions: granted },
    })
    return c.json({ id: role.id }, 201)
  })

  .put('/:id', requirePermission('core:roles-manage'), zValidator('json', body), async (c) => {
    const id = c.req.param('id')
    const b = c.req.valid('json')
    const db = await c.var.deps.db()
    const [role] = await db.select().from(roles).where(eq(roles.id, id))
    if (!role) return fail(c, 404, 'not_found')
    await db
      .update(roles)
      .set({
        nameFr: b.nameFr,
        nameEn: b.nameEn || null,
        descriptionFr: b.descriptionFr || null,
        descriptionEn: b.descriptionEn || null,
      })
      .where(eq(roles.id, id))
    const before = await permsOf(db, id)
    // Super admin has everything implicitly: its rights are never edited.
    const after = role.key === 'super-admin' ? before : await setPerms(db, id, b.permissions)
    await audit(c, {
      action: 'role.update',
      entityType: 'role',
      entityId: id,
      summaryFr: `Rôle « ${b.nameFr} » modifié`,
      summaryEn: `Role “${b.nameEn || b.nameFr}” updated`,
      diff: {
        added: after.filter((k) => !before.includes(k)),
        removed: before.filter((k) => !after.includes(k)),
        name: role.nameFr === b.nameFr ? undefined : { from: role.nameFr, to: b.nameFr },
      },
    })
    return c.json({ ok: true })
  })

  .post('/:id/duplicate', requirePermission('core:roles-manage'), async (c) => {
    const db = await c.var.deps.db()
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, c.req.param('id')))
    if (!role) return fail(c, 404, 'not_found')
    const nameFr = `${role.nameFr} (copie)`
    const [copy] = await db
      .insert(roles)
      .values({
        key: await uniqueKey(db, nameFr),
        nameFr,
        nameEn: role.nameEn ? `${role.nameEn} (copy)` : null,
        descriptionFr: role.descriptionFr,
        descriptionEn: role.descriptionEn,
      })
      .returning()
    if (!copy) return fail(c, 400, 'invalid')
    const granted = await setPerms(
      db,
      copy.id,
      role.key === 'super-admin' ? [] : await permsOf(db, role.id),
    )
    await audit(c, {
      action: 'role.create',
      entityType: 'role',
      entityId: copy.id,
      summaryFr: `Rôle « ${nameFr} » créé par copie de « ${role.nameFr} »`,
      summaryEn: `Role “${copy.nameEn ?? nameFr}” created as a copy of “${role.nameEn ?? role.nameFr}”`,
      diff: { permissions: granted },
    })
    return c.json({ id: copy.id }, 201)
  })

  .delete('/:id', requirePermission('core:roles-manage'), async (c) => {
    const id = c.req.param('id')
    const db = await c.var.deps.db()
    const [role] = await db.select().from(roles).where(eq(roles.id, id))
    if (!role) return fail(c, 404, 'not_found')
    if (role.isSystem) return fail(c, 409, 'system_role')
    const [used] = await db.select({ n: count() }).from(userRoles).where(eq(userRoles.roleId, id))
    if (used?.n) return fail(c, 409, 'in_use')
    const had = await permsOf(db, id)
    await db.delete(roles).where(eq(roles.id, id))
    await audit(c, {
      action: 'role.delete',
      entityType: 'role',
      entityId: id,
      summaryFr: `Rôle « ${role.nameFr} » supprimé`,
      summaryEn: `Role “${role.nameEn ?? role.nameFr}” deleted`,
      diff: { permissions: had },
    })
    return c.json({ ok: true })
  })
