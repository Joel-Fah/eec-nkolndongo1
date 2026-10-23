/**
 * The sitemap, built on demand (almost every page here is rendered from live content, so a build-time sitemap would list
 * only a handful). Static pages come from the navigation; news posts, events, guides and group pages from the same
 * edge-cached public JSON as the pages. Each address lists its other-language twin (hreflang). Cached for an hour. The
 * site is closed until launch (robots.txt and noindex), so this lists everything that WILL be indexable.
 */

import { locales } from '@eec/i18n'
import type { APIRoute } from 'astro'
import { publicJson } from '../lib/content-api'
import { departmentHref } from '../lib/departments-routes'
import { eventHref } from '../lib/events-routes'
import { guideHref } from '../lib/guides-routes'
import { href, pages } from '../lib/nav'
import { newsItemHref } from '../lib/news-routes'
import { sermonHref } from '../lib/sermons-routes'

export const prerender = false

/** Pages with real content (the others are « à venir » placeholders, not worth indexing yet). */
const BUILT = [
  'histoire',
  'croyances',
  'pasteurs',
  'trouver',
  'cultes',
  'departements',
  'pratique',
  'evenements',
  'dimanche',
  'nouvelles',
  'predications',
  'meditations',
  'give',
  'privacy',
  'legal',
  'credits',
]

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const GET: APIRoute = async (ctx) => {
  const origin = (ctx.site ?? ctx.url).origin
  const abs = (path: string) => new URL(path, origin).href
  type Entry = { fr: string; en: string; lastmod?: string }
  const entries: Entry[] = [{ fr: href('fr', ''), en: href('en', '') }]
  for (const id of BUILT) {
    const p = pages.find((x) => x.id === id)
    if (p) entries.push({ fr: href('fr', p.path.fr), en: href('en', p.path.en) })
  }
  const today = new Date().toISOString().slice(0, 10)
  const year = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
  const [news, events, guides, groups, sermons] = await Promise.all([
    Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        publicJson<{ items: { slug: string; publishedAt: string }[] }>(
          ctx,
          `/api/news/public?locale=fr&limit=24&page=${n}`,
        ),
      ),
    ),
    publicJson<{ items: { slug: string }[] }>(
      ctx,
      `/api/events/public?locale=fr&from=${today}&to=${year}`,
    ),
    publicJson<{ items: { slug: string }[] }>(ctx, '/api/guides/public?locale=fr'),
    publicJson<{ items: { key: string }[] }>(ctx, '/api/departments/public?locale=fr'),
    publicJson<{ items: { slug: string }[] }>(ctx, '/api/sermons/public?locale=fr&limit=24'),
  ])
  const seen = new Set<string>()
  for (const r of news)
    if (r.state === 'ok')
      for (const it of r.data.items)
        if (!seen.has(`n:${it.slug}`)) {
          seen.add(`n:${it.slug}`)
          entries.push({
            fr: newsItemHref('fr', it.slug),
            en: newsItemHref('en', it.slug),
            lastmod: it.publishedAt?.slice(0, 10),
          })
        }
  if (events.state === 'ok')
    for (const it of events.data.items)
      if (!seen.has(`e:${it.slug}`)) {
        seen.add(`e:${it.slug}`)
        entries.push({ fr: eventHref('fr', it.slug), en: eventHref('en', it.slug) })
      }
  if (sermons.state === 'ok')
    for (const it of sermons.data.items)
      entries.push({ fr: sermonHref('fr', it.slug), en: sermonHref('en', it.slug) })
  if (guides.state === 'ok')
    for (const it of guides.data.items)
      entries.push({ fr: guideHref('fr', it.slug), en: guideHref('en', it.slug) })
  if (groups.state === 'ok')
    for (const it of groups.data.items)
      entries.push({ fr: departmentHref('fr', it.key), en: departmentHref('en', it.key) })

  const urls = entries.flatMap((e) =>
    locales.map((l) => {
      const alts = locales
        .map(
          (a) =>
            `<xhtml:link rel="alternate" hreflang="${a === 'fr' ? 'fr-CM' : 'en-GB'}" href="${xml(abs(e[a]))}"/>`,
        )
        .join('')
      return `<url><loc>${xml(abs(e[l]))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}${alts}</url>`
    }),
  )
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
