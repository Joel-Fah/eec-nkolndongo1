import type { Db } from '@eec/db'
import { sql } from 'drizzle-orm'

/**
 * Fixed-window limiter in Postgres for our own endpoints (invitation/reset links). Better Auth's
 * built-in limiter protects its endpoints. Returns true when the call is allowed.
 */
export async function allow(db: Db, key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Date.now()
  const rows = await db.execute<{ count: number; last_request: string }>(sql`
    insert into rate_limit (key, count, last_request) values (${key}, 1, ${now})
    on conflict (key) do update set
      count = case when ${now} - rate_limit.last_request > ${windowSec * 1000} then 1 else rate_limit.count + 1 end,
      last_request = case when ${now} - rate_limit.last_request > ${windowSec * 1000} then ${now} else rate_limit.last_request end
    returning count, last_request`)
  return Number(rows.rows[0]?.count ?? 1) <= max
}
