/**
 * The daily retention job (docs/legal/data-protection.md): removes what we no longer need to keep.
 * Run by the Worker's Cron Trigger (src/worker.ts `scheduled`) and by `pnpm --filter @eec/api retention`.
 * Each run writes one row in `retention_runs` (what was removed, never who) — transparency for the council.
 *   - expired sessions, sign-in verifications, unused/expired invitation and reset links (kept 7 days after expiry)
 *   - sign-in rate-limit counters older than a day
 *   - mail outbox messages older than 90 days
 *   - audit entries older than 24 months
 *   - contact messages: 12 months after « handled » (at most 24 after receipt); prayer requests 3 months after « handled »
 *     (at most 6 after receipt)
 *   - member accounts whose deletion was requested more than 30 days ago (team accounts are never purged here)
 */
import { dbUrl, type Env } from '@eec/api-kit'
import { writeAudit } from '@eec/auth'
import { connect, schema } from '@eec/db'
import { and, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'

const DAY = 86_400_000
export const RETENTION = {
  outboxDays: 90,
  auditMonths: 24,
  deletionGraceDays: 30,
  linkGraceDays: 7,
  contactHandledMonths: 12,
  contactMaxMonths: 24,
  prayerHandledMonths: 3,
  prayerMaxMonths: 6,
}

export type RetentionResult = {
  sessions: number
  verifications: number
  links: number
  rateLimits: number
  outbox: number
  audit: number
  contact: number
  accountsPurged: number
  accountsSkipped: number
}

export async function runRetention(env: Env, now = new Date()): Promise<RetentionResult> {
  const { db, close } = await connect(dbUrl(env))
  try {
    const t = schema
    const count = async (q: Promise<unknown[]>) => (await q).length
    const result: RetentionResult = {
      sessions: await count(
        db.delete(t.session).where(lt(t.session.expiresAt, now)).returning({ id: t.session.id }),
      ),
      verifications: await count(
        db
          .delete(t.verification)
          .where(lt(t.verification.expiresAt, now))
          .returning({ id: t.verification.id }),
      ),
      links: await count(
        db
          .delete(t.accessLinks)
          .where(
            lt(t.accessLinks.expiresAt, new Date(now.getTime() - RETENTION.linkGraceDays * DAY)),
          )
          .returning({ id: t.accessLinks.id }),
      ),
      rateLimits: await count(
        db
          .delete(t.rateLimit)
          .where(lt(t.rateLimit.lastRequest, now.getTime() - DAY))
          .returning({ id: t.rateLimit.id }),
      ),
      outbox: await count(
        db
          .delete(t.mailOutbox)
          .where(lt(t.mailOutbox.createdAt, new Date(now.getTime() - RETENTION.outboxDays * DAY)))
          .returning({ id: t.mailOutbox.id }),
      ),
      audit: await count(
        db
          .delete(t.auditLog)
          .where(
            lt(
              t.auditLog.createdAt,
              sql`${now.toISOString()}::timestamptz - interval '${sql.raw(String(RETENTION.auditMonths))} months'`,
            ),
          )
          .returning({ id: t.auditLog.id }),
      ),
      contact: 0,
      accountsPurged: 0,
      accountsSkipped: 0,
    }

    // Contact messages (module `contact`, table read by name so this job needs no module import). Prayer requests go
    // sooner. The counts are the only thing recorded about them.
    const cm = sql.raw(
      `delete from contact_messages where
        (sensitive = false and ((handled_at is not null and handled_at < now() - interval '${RETENTION.contactHandledMonths} months') or created_at < now() - interval '${RETENTION.contactMaxMonths} months'))
        or (sensitive = true and ((handled_at is not null and handled_at < now() - interval '${RETENTION.prayerHandledMonths} months') or created_at < now() - interval '${RETENTION.prayerMaxMonths} months'))
        returning id`,
    )
    result.contact = (await db.execute(cm)).rows.length

    // Accounts past their grace period. Anyone holding a role other than « membre » is a team account: skipped.
    const due = await db
      .select({ userId: t.profiles.userId })
      .from(t.profiles)
      .where(
        and(
          isNotNull(t.profiles.deletionRequestedAt),
          lt(
            t.profiles.deletionRequestedAt,
            new Date(now.getTime() - RETENTION.deletionGraceDays * DAY),
          ),
        ),
      )
    for (const { userId } of due) {
      const team = await db
        .select({ id: t.userRoles.id })
        .from(t.userRoles)
        .innerJoin(t.roles, eq(t.roles.id, t.userRoles.roleId))
        .where(and(eq(t.userRoles.userId, userId), ne(t.roles.key, 'membre')))
        .limit(1)
      if (team.length) {
        result.accountsSkipped++
        continue
      }
      // The audit line keeps no name or address: only that an account was purged.
      await writeAudit(db, env.AUTH_SECRET, {
        actorId: null,
        action: 'account.purged',
        entityType: 'account',
        entityId: userId,
        summaryFr: 'Compte supprimé après le délai de grâce',
        summaryEn: 'Account deleted after the grace period',
      })
      await db.delete(t.user).where(inArray(t.user.id, [userId]))
      result.accountsPurged++
    }

    await db.insert(t.retentionRuns).values({ result })
    return result
  } finally {
    await close()
  }
}
