/**
 * Content lifecycle shared by every module (news, events, guides…): draft → scheduled → published → archived.
 * « Scheduled » is not a separate moment in the database: a row is `published` with a `publishAt` date, and it
 * becomes visible when that date passes — no job needed. `statusOf` is the single place that reads it.
 */
export const STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const
export type Status = (typeof STATUSES)[number]

export type Lifecycle = {
  /** What the editors chose: draft | published | archived. */
  state: 'draft' | 'published' | 'archived'
  publishAt: Date | null
  unpublishAt: Date | null
}

/** What the public and the editors' list see right now. */
export function statusOf(row: Lifecycle, now: Date = new Date()): Status {
  if (row.state === 'draft') return 'draft'
  if (row.state === 'archived') return 'archived'
  if (row.unpublishAt && row.unpublishAt <= now) return 'archived'
  if (row.publishAt && row.publishAt > now) return 'scheduled'
  return 'published'
}

export const isLive = (row: Lifecycle, now?: Date) => statusOf(row, now) === 'published'

/** Plain-language checks before publishing. Returns the problems (empty = ready). */
export function publishProblems(input: {
  title: string
  bodyEmpty: boolean
  publishAt: Date | null
  unpublishAt: Date | null
}): ('title' | 'body' | 'dates')[] {
  const out: ('title' | 'body' | 'dates')[] = []
  if (!input.title.trim()) out.push('title')
  if (input.bodyEmpty) out.push('body')
  if (input.publishAt && input.unpublishAt && input.unpublishAt <= input.publishAt)
    out.push('dates')
  return out
}

/** `a-title` → `a-title-2` when taken. */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  const root = base || 'sans-titre'
  if (!taken(root)) return root
  for (let i = 2; i < 1000; i++) if (!taken(`${root}-${i}`)) return `${root}-${i}`
  return `${root}-${Date.now()}`
}
