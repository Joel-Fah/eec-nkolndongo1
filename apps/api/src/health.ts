/**
 * The daily health check (Admin → Système → Santé). Runs in the same Cron Trigger as the retention job (no new
 * schedule) and on demand from the admin. Each check says ok / warn / fail with a plain number; the worst one is the
 * row's status. It only READS (and writes its own row): nothing here changes parish data. Warnings start at 70 % of a
 * free limit. What a Worker cannot see (Neon egress, Workers requests per day) is said so in the admin, with where to look.
 */
import { dbUrl, type Env } from '@eec/api-kit'
import { connect, schema } from '@eec/db'
import { AwsClient } from 'aws4fetch'
import { desc, eq, lt, sql } from 'drizzle-orm'

export type Level = 'ok' | 'warn' | 'fail'
export type Check = {
  id: 'database' | 'bucket' | 'backup' | 'outbox' | 'dbSize' | 'mediaSize'
  level: Level
  /** The measured number (ms, days, count, bytes) and its limit when there is one, for the admin to phrase. */
  value: number | null
  limit?: number
}

const MB = 1024 * 1024
/** Neon Free: 0.5 GB of storage. Neon Object Storage Free: 5 GB (decision 0020). */
export const LIMITS = { dbBytes: 512 * MB, mediaBytes: 5 * 1024 * MB }
const WARN_AT = 0.7
const FAIL_AT = 0.9
const BACKUP_WARN_DAYS = 9 // weekly backup + two days of slack
const BACKUP_FAIL_DAYS = 15

export const worst = (levels: Level[]): Level =>
  levels.includes('fail') ? 'fail' : levels.includes('warn') ? 'warn' : 'ok'

/** Level for « used of limit » against the 70 % / 90 % marks. */
export const usageLevel = (used: number, limit: number): Level =>
  used >= limit * FAIL_AT ? 'fail' : used >= limit * WARN_AT ? 'warn' : 'ok'

async function pingBucket(env: Env): Promise<boolean> {
  const endpoint = env.AWS_ENDPOINT_URL_S3
  if (!endpoint || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) return false
  const aws = new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION ?? 'auto',
    service: 's3',
  })
  const res = await aws.fetch(
    `${endpoint.replace(/\/$/, '')}/${env.MEDIA_BUCKET ?? 'eec-media'}?list-type=2&max-keys=1`,
    { signal: AbortSignal.timeout(5000) },
  )
  return res.ok
}

export async function runHealth(env: Env, now = new Date()) {
  const { db, close } = await connect(dbUrl(env))
  try {
    const checks: Check[] = []

    const t0 = Date.now()
    await db.execute(sql`select 1`)
    const ms = Date.now() - t0
    checks.push({
      id: 'database',
      level: ms > 3000 ? 'fail' : ms > 1500 ? 'warn' : 'ok',
      value: ms,
    })

    const bucketOk = await pingBucket(env).catch(() => false)
    checks.push({ id: 'bucket', level: bucketOk ? 'ok' : 'fail', value: bucketOk ? 1 : 0 })

    const [mark] = await db
      .select()
      .from(schema.systemMarks)
      .where(eq(schema.systemMarks.key, 'backup'))
    const days = mark ? (now.getTime() - mark.at.getTime()) / 86_400_000 : null
    checks.push({
      id: 'backup',
      // Never recorded (the first weeks after this check exists) is « to watch », not an alarm.
      level:
        days === null || days > BACKUP_WARN_DAYS
          ? days !== null && days > BACKUP_FAIL_DAYS
            ? 'fail'
            : 'warn'
          : 'ok',
      value: days === null ? null : Math.floor(days),
      limit: BACKUP_WARN_DAYS,
    })

    const [box] = (
      await db.execute<{ n: number; oldest_days: number | null }>(
        sql`select count(*)::int as n, extract(day from now() - min(created_at))::int as oldest_days from mail_outbox where status = 'pending'`,
      )
    ).rows
    const pending = box?.n ?? 0
    const oldest = box?.oldest_days ?? 0
    checks.push({
      id: 'outbox',
      level: pending > 20 || oldest > 7 ? 'fail' : pending > 5 || oldest > 3 ? 'warn' : 'ok',
      value: pending,
    })

    const dbSize = Number(
      (await db.execute<{ s: string }>(sql`select pg_database_size(current_database())::text as s`))
        .rows[0]?.s ?? 0,
    )
    checks.push({
      id: 'dbSize',
      level: usageLevel(dbSize, LIMITS.dbBytes),
      value: dbSize,
      limit: LIMITS.dbBytes,
    })

    const media = Number(
      (
        await db.execute<{ s: string }>(
          sql`select coalesce(sum(size_bytes), 0)::text as s from media_files`,
        )
      ).rows[0]?.s ?? 0,
    )
    checks.push({
      id: 'mediaSize',
      level: usageLevel(media, LIMITS.mediaBytes),
      value: media,
      limit: LIMITS.mediaBytes,
    })

    const status = worst(checks.map((c) => c.level))
    await db.insert(schema.systemHealth).values({ status, checks })
    // Keep 90 days.
    await db
      .delete(schema.systemHealth)
      .where(lt(schema.systemHealth.checkedAt, new Date(now.getTime() - 90 * 86_400_000)))
    return { status, checks }
  } finally {
    await close()
  }
}

export async function latestHealth(db: Awaited<ReturnType<typeof connect>>['db']) {
  const [row] = await db
    .select()
    .from(schema.systemHealth)
    .orderBy(desc(schema.systemHealth.checkedAt))
    .limit(1)
  return row ?? null
}
