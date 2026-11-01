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

export async function publicJson<T>(
  { url, locals }: Ctx,
  path: string,
  /** The visitor's request, when the answer is rate-limited per address (the API reads it from these headers). */
  from?: Request,
): Promise<ApiResult<T>> {
  try {
    const headers = new Headers()
    for (const name of ['cf-connecting-ip', 'x-forwarded-for', 'user-agent'])
      if (from?.headers.has(name)) headers.set(name, from.headers.get(name) as string)
    const res = await app.fetch(
      new Request(new URL(path, url), { headers }),
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

/** Is this visitor a signed-in member? Asked with their own cookies (the page that uses it must be `private, no-store`). */
export async function isMember({
  url,
  locals,
  request,
}: Ctx & { request: Request }): Promise<boolean> {
  try {
    const headers = new Headers({ origin: url.origin })
    for (const name of ['cookie', 'cf-connecting-ip', 'x-forwarded-for', 'user-agent'])
      if (request.headers.has(name)) headers.set(name, request.headers.get(name) as string)
    const res = await app.fetch(
      new Request(new URL('/api/me/membership', url), { headers }),
      env as unknown as Env,
      (locals as { cfContext?: ExecutionContext }).cfContext,
    )
    return res.ok && ((await res.json()) as { member?: boolean }).member === true
  } catch {
    return false
  }
}

/**
 * A form posted to the page (a registration, a cancellation) goes to the same API, in the same Worker, with what the API's
 * checks need: the page's origin (CSRF), the visitor's address (rate limit) and cookies (a signed-in member). No JavaScript needed.
 */
export async function apiPost<T>(
  { url, locals, request }: Ctx & { request: Request },
  path: string,
  body: unknown,
): Promise<{ status: number; data: T | null }> {
  try {
    const headers = new Headers({ 'content-type': 'application/json', origin: url.origin })
    for (const name of ['cookie', 'cf-connecting-ip', 'x-forwarded-for', 'user-agent'])
      if (request.headers.has(name)) headers.set(name, request.headers.get(name) as string)
    const res = await app.fetch(
      new Request(new URL(path, url), { method: 'POST', headers, body: JSON.stringify(body) }),
      env as unknown as Env,
      (locals as { cfContext?: ExecutionContext }).cfContext,
    )
    return { status: res.status, data: (await res.json().catch(() => null)) as T | null }
  } catch {
    return { status: 503, data: null }
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
  kind: string
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

export type SermonItem = {
  id: string
  slug: string
  title: string
  summary: string
  fallback: boolean
  preachedOn: string | null
  preacher: string
  series: { slug: string; title: string } | null
  refs: { book: string; label: string }[]
  hasVideo: boolean
  hasLinks: boolean
  cover: NewsCover | null
}
export type SermonDetail = SermonItem & {
  html: string
  text: string
  transcriptHtml: string
  youtubeId: string
  links: {
    kind: 'audio' | 'notes' | 'slides' | 'other'
    label: string
    url: string
    host: string
  }[]
  sundayDate: string | null
}
export type SermonFilters = {
  months: string[]
  series: { slug: string; title: string; description: string; count: number }[]
  preachers: string[]
  books: { id: string; label: string }[]
  years: string[]
}

export type MeditationDay = {
  date: string
  headline: string
  readings: { label: string; ref: string }[]
  psalm: string
  reflection: string
  verse: { ref: string; text: string; translation: string } | null
}
export type MeditationPlan = {
  slug: string
  title: string
  description: string
  startsOn: string
  endsOn: string
}

export type PublicRegField = {
  id: string
  kind: 'group' | 'text' | 'choice' | 'multi' | 'yesno'
  label: string
  required: boolean
  options: { value: string; label: string }[]
}
export type PublicRegForm = {
  slug: string
  title: string
  intro: string
  eventSlug: string | null
  eventDate: string
  audience: 'open' | 'members'
  forMinors: boolean
  askWhatsapp: boolean
  waitlist: boolean
  state: 'draft' | 'not_yet' | 'open' | 'full' | 'closed'
  spotsLeft: number | null
  fields: PublicRegField[]
}
