import type { Db } from '@eec/db'
import { schema } from '@eec/db'
import { type DefinedModule, splitPermission } from '@eec/modules-kit'
import { eq, notInArray, sql } from 'drizzle-orm'
import { systemRoles } from './core-module.ts'

/**
 * The grants of a system role that have never been offered yet (decision 0048): the grants in code that the manifests declare, minus
 * those already in the ledger. Pure, so it can be tested without a database.
 */
export function missingGrants(
  inCode: readonly string[],
  offered: ReadonlySet<string>,
  known: ReadonlySet<string>,
): string[] {
  return [...new Set(inCode)].filter((k) => known.has(k) && !offered.has(k))
}

/**
 * Idempotent: running it twice changes nothing. Permissions follow the manifests (removed ones are marked `deprecated`, never
 * deleted). Each grant of a system role is **offered once** (decision 0048): a permission added to the code reaches every environment
 * on its next seed, a grant someone removed on purpose in Rôles never comes back (it is in the ledger), and a grant added by hand is
 * never touched. Nothing is ever deleted.
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
  let offeredGrants = 0
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
    const created = inserted[0]
    let roleId = created?.id
    if (created) createdRoles++
    else {
      const [row] = await db
        .update(schema.roles)
        .set({ isSystem: true })
        .where(eq(schema.roles.key, role.key))
        .returning({ id: schema.roles.id })
      roleId = row?.id
    }
    if (!roleId) continue
    const offered = new Set(
      (
        await db
          .select({ k: schema.rolePermissionOffers.permissionKey })
          .from(schema.rolePermissionOffers)
          .where(eq(schema.rolePermissionOffers.roleId, roleId))
      ).map((r) => r.k),
    )
    const fresh = missingGrants(role.grants, offered, known)
    if (fresh.length) {
      await db
        .insert(schema.rolePermissions)
        .values(fresh.map((permissionKey) => ({ roleId, permissionKey })))
        .onConflictDoNothing()
      await db
        .insert(schema.rolePermissionOffers)
        .values(fresh.map((permissionKey) => ({ roleId, permissionKey })))
        .onConflictDoNothing()
      offeredGrants += fresh.length
    }
  }
  return {
    permissions: defs.length,
    createdRoles,
    offeredGrants,
    modules: [...new Set(defs.map((d) => splitPermission(d.key).module))],
  }
}
