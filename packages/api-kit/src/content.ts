/**
 * Content versions (decision 0021): one counter per area, bumped on every save. Public reads put it in
 * their edge-cache key, so a change shows up within seconds without a global purge (no zone yet).
 * Reading it costs one tiny query at most every few seconds per Worker isolate (memoised in memory).
 */
import type { Db } from '@eec/db'
import { schema } from '@eec/db'
import { eq, sql } from 'drizzle-orm'

const MEMO_MS = 5_000
const memo = new Map<string, { version: number; at: number }>()

/**
 * The version for a public read, without opening a database connection when the memo is fresh (a cache hit then
 * costs no database round trip at all). Returns 0 if the database cannot be reached: the caller then reads the
 * « version 0 » entry, which is only ever a stale copy or a miss.
 */
export async function versionFor(
  openDb: () => Promise<Db>,
  area: string,
  timeoutMs = 1500,
): Promise<number> {
  const hit = memo.get(area)
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.version
  try {
    return await Promise.race([
      openDb().then((db) => contentVersion(db, area)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
  } catch {
    return hit?.version ?? 0
  }
}

export async function contentVersion(db: Db, area: string): Promise<number> {
  const hit = memo.get(area)
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.version
  const [row] = await db
    .select({ version: schema.contentVersions.version })
    .from(schema.contentVersions)
    .where(eq(schema.contentVersions.area, area))
  const version = row?.version ?? 1
  memo.set(area, { version, at: Date.now() })
  return version
}

export async function bumpContentVersion(db: Db, area: string): Promise<void> {
  await db
    .insert(schema.contentVersions)
    .values({ area, version: 2 })
    .onConflictDoUpdate({
      target: schema.contentVersions.area,
      set: { version: sql`${schema.contentVersions.version} + 1` },
    })
  memo.delete(area)
}
