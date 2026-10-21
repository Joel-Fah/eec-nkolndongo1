/** Who can do what. Authorization is ours (decision 0005); Better Auth only answers "who are you". */
import type { Db } from '@eec/db'
import { schema } from '@eec/db'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'

export type Grant = { roleKey: string; groupId: string | null; permissions: ReadonlySet<string> }

export type Principal = {
  userId: string
  status: 'active' | 'invited' | 'deactivated'
  isSuperAdmin: boolean
  grants: readonly Grant[]
}

/** Load a user's effective rights once per request (callers memoise on the request context). */
export async function loadPrincipal(db: Db, userId: string): Promise<Principal | null> {
  const [profile] = await db
    .select({ status: schema.profiles.status })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
  if (!profile) return null

  const rows = await db
    .select({
      roleKey: schema.roles.key,
      groupId: schema.userRoles.groupId,
      permission: schema.rolePermissions.permissionKey,
    })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .leftJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.roles.id))
    .where(
      and(
        eq(schema.userRoles.userId, userId),
        or(isNull(schema.userRoles.expiresAt), gt(schema.userRoles.expiresAt, sql`now()`)),
      ),
    )

  const byGrant = new Map<
    string,
    { roleKey: string; groupId: string | null; permissions: Set<string> }
  >()
  for (const r of rows) {
    const k = `${r.roleKey}|${r.groupId ?? ''}`
    const g = byGrant.get(k) ?? {
      roleKey: r.roleKey,
      groupId: r.groupId,
      permissions: new Set<string>(),
    }
    if (r.permission) g.permissions.add(r.permission)
    byGrant.set(k, g)
  }
  const grants = [...byGrant.values()]
  return {
    userId,
    status: profile.status,
    isSuperAdmin: grants.some((g) => g.roleKey === 'super-admin' && g.groupId === null),
    grants,
  }
}

/**
 * Can the principal do `permission`? A global grant allows it everywhere; a group-scoped grant only for
 * resources of that group, so pass `groupId` when the resource belongs to one.
 */
export function can(
  p: Principal | null,
  permission: string,
  opts: { groupId?: string | null } = {},
): boolean {
  if (p?.status !== 'active') return false
  if (p.isSuperAdmin) return true
  return p.grants.some(
    (g) => g.permissions.has(permission) && (g.groupId === null || g.groupId === opts.groupId),
  )
}

/** Does the principal hold `permission` for at least one scope? (menu visibility, list screens) */
export function canAnywhere(p: Principal | null, permission: string): boolean {
  if (p?.status !== 'active') return false
  return p.isSuperAdmin || p.grants.some((g) => g.permissions.has(permission))
}

/** Group ids where the principal holds the permission via a scoped grant ('all' if global/super admin). */
export function scopeFor(p: Principal | null, permission: string): 'all' | string[] {
  if (p?.status !== 'active') return []
  if (p.isSuperAdmin || p.grants.some((g) => g.groupId === null && g.permissions.has(permission)))
    return 'all'
  return p.grants
    .filter((g) => g.groupId && g.permissions.has(permission))
    .map((g) => g.groupId as string)
}

/** Any admin right at all → shorter staff session lifetime. */
export function isStaff(p: Principal | null): boolean {
  if (!p) return false
  return (
    p.isSuperAdmin || p.grants.some((g) => [...g.permissions].some((k) => !k.startsWith('member')))
  )
}
