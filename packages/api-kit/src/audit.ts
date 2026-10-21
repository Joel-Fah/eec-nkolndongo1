import { type AuditEntry, writeAudit } from '@eec/auth'
import type { Context } from 'hono'
import type { AppEnv } from './context.ts'
import { clientIp } from './guards.ts'

/**
 * Audit a mutation from a route: actor, IP hash and user agent come from the request. Every mutation
 * calls this (Phase 02 §5.3); logins and permission changes always do.
 */
export async function audit(
  c: Context<AppEnv>,
  entry: Omit<AuditEntry, 'actorId' | 'ip' | 'userAgent'> & { actorId?: string | null },
) {
  const db = await c.var.deps.db()
  const actor = entry.actorId === undefined ? await c.var.deps.actor() : null
  await writeAudit(db, c.env.AUTH_SECRET, {
    ...entry,
    actorId: entry.actorId === undefined ? (actor?.userId ?? null) : entry.actorId,
    ip: clientIp(c),
    userAgent: c.req.header('user-agent'),
  })
}
