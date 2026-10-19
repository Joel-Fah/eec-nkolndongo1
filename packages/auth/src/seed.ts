import type { Db } from '@eec/db'
import { schema } from '@eec/db'
import { type DefinedModule, splitPermission } from '@eec/modules-kit'
import { eq, notInArray, sql } from 'drizzle-orm'
import { systemRoles } from './core-module.ts'

/**
 * Idempotent: running it twice changes nothing. Permissions follow the manifests (removed ones are marked
 * `deprecated`, never deleted). A system role's grants are written only when the role is first created, so
 * edits made in the admin are never overwritten by a re-seed.
 */
export async function seedRbac(db: Db, modules: readonly DefinedModule[]) {
  const defs = modules.flatMap((m) =>
    m.permissions.map((p) => ({
      key: `${m.id}:${p.action}`,
      module: m.id,
      labelFr: p.label.fr,
      labelEn: p.label.en,
      descriptionFr: p.description?.fr ?? null,
      descriptionEn: p.description?.en ?? null,
      isDangerous: p.dangerous ?? false,
      deprecated: false,
    })),
  )
  if (defs.length) {
    await db
      .insert(schema.permissions)
      .values(defs)
      .onConflictDoUpdate({
        target: schema.permissions.key,
        set: {
          module: sql`excluded.module`,
          labelFr: sql`excluded.label_fr`,
          labelEn: sql`excluded.label_en`,
          descriptionFr: sql`excluded.description_fr`,
          descriptionEn: sql`excluded.description_en`,
          isDangerous: sql`excluded.is_dangerous`,
          deprecated: sql`false`,
        },
      })
    await db
      .update(schema.permissions)
      .set({ deprecated: true })
      .where(
        notInArray(
          schema.permissions.key,
          defs.map((d) => d.key),
        ),
      )
  }

  const known = new Set(defs.map((d) => d.key))
  let createdRoles = 0
  for (const role of systemRoles) {
    const inserted = await db
      .insert(schema.roles)
      .values({
        key: role.key,
        nameFr: role.fr,
        nameEn: role.en,
        descriptionFr: role.descFr,
        descriptionEn: role.descEn,
        isSystem: true,
      })
      .onConflictDoNothing({ target: schema.roles.key })
      .returning({ id: schema.roles.id })
    if (inserted[0]) {
      createdRoles++
      const grants = role.grants
        .filter((k) => known.has(k))
        .map((permissionKey) => ({ roleId: inserted[0]!.id, permissionKey }))
      if (grants.length)
        await db.insert(schema.rolePermissions).values(grants).onConflictDoNothing()
    } else {
      await db.update(schema.roles).set({ isSystem: true }).where(eq(schema.roles.key, role.key))
    }
  }
  return {
    permissions: defs.length,
    createdRoles,
    modules: [...new Set(defs.map((d) => splitPermission(d.key).module))],
  }
}
