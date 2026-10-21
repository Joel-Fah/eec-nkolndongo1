import { type Db, schema } from '@eec/db'
import { ipHash } from './crypto.ts'

export type AuditEntry = {
  actorId: string | null
  /** create | update | delete | publish | login | logout | role.grant | role.revoke | link.create | … */
  action: string
  entityType: string
  entityId?: string | null
  summaryFr: string
  summaryEn?: string
  /** Changed fields only. Never secrets, passwords or tokens. */
  diff?: unknown
  ip?: string | null
  userAgent?: string | null
}

const FORBIDDEN = /pass(word)?|token|secret|hash|cookie/i

/** Drop any field whose name looks like a secret, at any depth (defence in depth). */
export function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !FORBIDDEN.test(k))
        .map(([k, v]) => [k, scrub(v)]),
    )
  }
  return value
}

export async function writeAudit(db: Db, secret: string, e: AuditEntry) {
  await db.insert(schema.auditLog).values({
    actorId: e.actorId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId ?? null,
    summaryFr: e.summaryFr,
    summaryEn: e.summaryEn ?? null,
    diff: e.diff === undefined ? null : scrub(e.diff),
    ipHash: await ipHash(e.ip, secret),
    userAgent: e.userAgent?.slice(0, 120) ?? null,
  })
}
