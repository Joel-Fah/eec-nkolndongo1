/**
 * Visit counts without tracking (decision 0038). For each page the Worker itself serves, one data point in a Workers
 * Analytics Engine dataset: the day, the path, the language and a coarse device class (mobile/desktop). No cookie, no
 * IP address, no user agent stored (it is read once to skip robots and to tell mobile from desktop, then dropped), no
 * identifier of any kind: two visits by the same person are indistinguishable. Skipped when the browser says « do not
 * track » (DNT / Sec-GPC). Pages served as static files never reach the Worker, so they are not counted (documented gap).
 * Without the VISITS binding this is a no-op.
 */

import type { Env } from '@eec/api-kit'
import { adminPrefix } from '@eec/core'

const ROBOT =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|lighthouse|headless/i
const PATH_OK = /^\/(fr|en)(\/[a-z0-9][a-z0-9-]*)*$/

export type Visit = { day: string; path: string; locale: 'fr' | 'en'; device: 'mobile' | 'desktop' }

/** What to count for this request/response, or null if it is not a countable page view. */
export function visitOf(
  request: Request,
  status: number,
  contentType: string | null,
  env: Pick<Env, 'ADMIN_PATH'>,
  now = new Date(),
): Visit | null {
  if (request.method !== 'GET' || status !== 200) return null
  if (!contentType?.includes('text/html')) return null
  const url = new URL(request.url)
  const h = request.headers
  if (h.get('dnt') === '1' || h.get('sec-gpc') === '1') return null
  if (/prefetch/i.test(`${h.get('sec-purpose') ?? ''}${h.get('purpose') ?? ''}`)) return null
  if (url.searchParams.has('preview')) return null
  const prefix = adminPrefix(env.ADMIN_PATH)
  if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) return null
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname
  if (path.startsWith('/fr/_brand') || path.startsWith('/en/_brand')) return null
  if (path.length > 120 || !PATH_OK.test(path)) return null
  const ua = h.get('user-agent') ?? ''
  if (!ua || ROBOT.test(ua)) return null
  const mobileHint = h.get('sec-ch-ua-mobile')
  const mobile = mobileHint ? mobileHint === '?1' : /Mobi|Android|iPhone|iPad/i.test(ua)
  return {
    day: now.toISOString().slice(0, 10),
    path,
    locale: path.startsWith('/en') ? 'en' : 'fr',
    device: mobile ? 'mobile' : 'desktop',
  }
}

export function recordVisit(env: Env, request: Request, response: Response, now = new Date()) {
  if (!env.VISITS) return
  const v = visitOf(request, response.status, response.headers.get('content-type'), env, now)
  if (!v) return
  try {
    env.VISITS.writeDataPoint({
      indexes: [v.day],
      blobs: [v.path, v.locale, v.device],
      doubles: [1],
    })
  } catch {
    // Counting never breaks a page.
  }
}

export type VisitStats = {
  configured: boolean
  days: string[]
  perDay: { fr: number[]; en: number[] }
  top: { path: string; visits: number }[]
  devices: { mobile: number; desktop: number }
}

/** Reads the last 30 days back from the Analytics Engine SQL API (admin only). Null = not set up / not reachable. */
export async function readVisits(env: Env, now = new Date()): Promise<VisitStats | null> {
  const dataset = env.VISITS_DATASET
  if (!env.VISITS || !env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN || !dataset) return null
  if (!/^[A-Za-z0-9_]{1,64}$/.test(dataset)) return null
  const sql = async (query: string) => {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` },
        body: query,
        signal: AbortSignal.timeout(6000),
      },
    )
    if (!res.ok) throw new Error(`analytics ${res.status}`)
    return ((await res.json()) as { data: Record<string, string | number>[] }).data
  }
  const since = `timestamp > NOW() - INTERVAL '30' DAY`
  const [byDay, top, dev] = await Promise.all([
    sql(
      `SELECT index1 AS day, blob2 AS locale, SUM(_sample_interval) AS n FROM ${dataset} WHERE ${since} GROUP BY day, locale`,
    ),
    sql(
      `SELECT blob1 AS path, SUM(_sample_interval) AS n FROM ${dataset} WHERE ${since} GROUP BY path ORDER BY n DESC LIMIT 15`,
    ),
    sql(
      `SELECT blob3 AS device, SUM(_sample_interval) AS n FROM ${dataset} WHERE ${since} GROUP BY device`,
    ),
  ])
  const days = Array.from({ length: 30 }, (_, i) =>
    new Date(now.getTime() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
  )
  const perDay = { fr: days.map(() => 0), en: days.map(() => 0) }
  for (const r of byDay) {
    const i = days.indexOf(String(r.day))
    const lang = r.locale === 'en' ? 'en' : 'fr'
    if (i >= 0) perDay[lang][i] = Math.round(Number(r.n))
  }
  const device = (d: string) => Math.round(Number(dev.find((r) => r.device === d)?.n ?? 0))
  return {
    configured: true,
    days,
    perDay,
    top: top.map((r) => ({ path: String(r.path), visits: Math.round(Number(r.n)) })),
    devices: { mobile: device('mobile'), desktop: device('desktop') },
  }
}
