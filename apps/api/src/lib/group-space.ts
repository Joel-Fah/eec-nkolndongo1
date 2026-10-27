/** Small pure rules of « Mon groupe » (decision 0049), kept apart so they can be tested. */
import type { MemberAgeBand } from '@eec/core'

/** The age bands of a group are shown only when at least this many people have one: below it, a band could point at a person. */
export const MIN_FOR_BANDS = 5

export function bandCounts(bands: (MemberAgeBand | null)[]): Record<string, number> | null {
  const known = bands.filter((b): b is MemberAgeBand => !!b)
  if (known.length < MIN_FOR_BANDS) return null
  const out: Record<string, number> = {}
  for (const b of known) out[b] = (out[b] ?? 0) + 1
  return out
}

/** A number is shown to a leader only if the member chose to share it with this group and gave one. */
export const visiblePhone = (share: boolean, phone: string | null) =>
  share && phone ? phone : null

/** A spreadsheet would run a cell starting with = + - @ as a formula: defuse it. */
export const csvCell = (v: unknown) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replaceAll('"', '""')}"`
}
