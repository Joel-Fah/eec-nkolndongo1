/**
 * The public site reads content through the same API as everyone, in the same Worker (no network hop):
 * the API caches at the edge (decision 0027), pages render on demand from that JSON. A slow or unreachable
 * database becomes `unavailable` — pages show a friendly state, never a 500.
 */
import { env } from 'cloudflare:workers'
import type { ExecutionContext } from '@cloudflare/workers-types'
import { createApp } from '@eec/api'
import type { Env } from '@eec/api-kit'

const app = createApp()

export type ApiResult<T> =
  | { state: 'ok'; data: T }
  | { state: 'missing' }
  | { state: 'unavailable' }

type Ctx = { url: URL; locals: unknown }

export async function publicJson<T>({ url, locals }: Ctx, path: string): Promise<ApiResult<T>> {
  try {
    const res = await app.fetch(
      new Request(new URL(path, url)),
      env as unknown as Env,
      (locals as { cfContext?: ExecutionContext }).cfContext,
    )
    if (res.status === 404) return { state: 'missing' }
    if (!res.ok) return { state: 'unavailable' }
    return { state: 'ok', data: (await res.json()) as T }
  } catch {
    return { state: 'unavailable' }
  }
}

export type NewsCover = {
  variants: { key: string; width: number; size: number; mime: string }[]
  placeholder: string | null
  altFr: string | null
  altEn: string | null
  width: number | null
  height: number | null
  credit: string | null
}
export type NewsItem = {
  id: string
  slug: string
  title: string
  excerpt: string
  fallback: boolean
  publishedAt: string
  pinned: boolean
  group: string | null
  cover: NewsCover | null
}
export type NewsDetail = NewsItem & { html: string; text: string }

export type EventOcc = {
  eventId: string
  slug: string
  title: string
  description: string
  date: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  cancelled: boolean
  moved: boolean
  note: string
  location: string
  locationKind: string
  fallback: boolean
  featured: boolean
  group: string | null
  groupKey: string | null
  cover: NewsCover | null
  registrationUrl: string | null
}
export type EventDetail = EventOcc & {
  html: string
  timezone: string
  recurring: boolean
  upcoming: Pick<EventOcc, 'date' | 'startsAt' | 'endsAt' | 'cancelled' | 'moved' | 'note'>[]
}

export type PublicSlot = {
  id: string
  kind: string
  labelFr: string
  labelEn: string
  weekday: number
  start: string
  end: string | null
  placeFr?: string
  placeEn?: string
}
export type PublicSlotException = {
  date: string
  slotId: string | null
  kind: 'cancelled' | 'changed' | 'extra'
  noteFr?: string
  noteEn?: string
  start?: string
  end?: string | null
  labelFr?: string
  labelEn?: string
}
