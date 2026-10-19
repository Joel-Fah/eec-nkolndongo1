/**
 * Session lifetimes (Phase 02 §4.2). Better Auth's own refresh applies one global lifetime, so we disable
 * it and slide sessions ourselves: staff 12 h idle with a 7-day hard cap; members 30 days idle.
 */
import { type Db, schema } from '@eec/db'
import { eq } from 'drizzle-orm'

export const STAFF_IDLE_MS = 12 * 60 * 60 * 1000
export const STAFF_MAX_MS = 7 * 24 * 60 * 60 * 1000
export const MEMBER_MS = 30 * 24 * 60 * 60 * 1000
/** Write at most once an hour per session. */
const SLIDE_EVERY_MS = 60 * 60 * 1000

export function sessionExpiry(opts: { staff: boolean; createdAt: Date; now?: number }): Date {
  const now = opts.now ?? Date.now()
  if (!opts.staff) return new Date(now + MEMBER_MS)
  return new Date(Math.min(now + STAFF_IDLE_MS, opts.createdAt.getTime() + STAFF_MAX_MS))
}

/** Extend a live session if it's been used and is due; returns the (possibly new) expiry. */
export async function slideSession(
  db: Db,
  s: { id: string; createdAt: Date; expiresAt: Date },
  staff: boolean,
  now = Date.now(),
): Promise<Date> {
  const next = sessionExpiry({ staff, createdAt: s.createdAt, now })
  if (next.getTime() - s.expiresAt.getTime() < SLIDE_EVERY_MS) return s.expiresAt
  await db.update(schema.session).set({ expiresAt: next }).where(eq(schema.session.id, s.id))
  return next
}
