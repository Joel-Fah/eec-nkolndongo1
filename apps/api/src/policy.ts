/**
 * The privacy-policy version in force: the label of the latest published « privacy » document (module `legal`), else the
 * built-in draft label. Read by name (no module import); remembered for a minute per Worker instance, and a database that
 * is slow or down never blocks sign-up or Mon espace — the last known value (or the draft label) is used.
 */
import type { Db } from '@eec/db'
import { sql } from 'drizzle-orm'

export const DRAFT_POLICY = '2026-10-brouillon'
export type Policy = {
  version: string
  summaryFr: string
  summaryEn: string
  purposeChanged: boolean
  publishedAt: string | null
}

let memo: { at: number; value: Policy } | undefined
const MEMO_MS = 60_000

export async function currentPolicy(db: Db): Promise<Policy> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value
  try {
    const r = await db.execute<{
      label: string
      summary_fr: string
      summary_en: string
      purpose_changed: boolean
      published_at: string | null
    }>(
      sql`select label, summary_fr, summary_en, purpose_changed, published_at from legal_documents where doc_key = 'privacy' and state = 'published' order by version desc limit 1`,
    )
    const row = r.rows[0]
    const value: Policy = row
      ? {
          version: row.label,
          summaryFr: row.summary_fr,
          summaryEn: row.summary_en,
          purposeChanged: row.purpose_changed,
          publishedAt: row.published_at,
        }
      : {
          version: DRAFT_POLICY,
          summaryFr: '',
          summaryEn: '',
          purposeChanged: false,
          publishedAt: null,
        }
    memo = { at: Date.now(), value }
    return value
  } catch {
    return (
      memo?.value ?? {
        version: DRAFT_POLICY,
        summaryFr: '',
        summaryEn: '',
        purposeChanged: false,
        publishedAt: null,
      }
    )
  }
}
export const policyVersion = async (db: Db) => (await currentPolicy(db)).version
export const resetPolicyMemo = () => {
  memo = undefined
}
