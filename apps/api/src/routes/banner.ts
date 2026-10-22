/**
 * A random abstract photo for the admin's Design guide banner, on every visit: nothing is stored. Uses the same Pexels key as
 * the media library's stock search (admin only; the public site never calls Pexels). The browser loads the picture itself from
 * Pexels' image host (allowed by the admin's content policy) and shows the photographer's credit.
 */
import { type AppEnv, fail, requirePermission } from '@eec/api-kit'
import { Hono } from 'hono'

const QUERIES = [
  'abstract gradient',
  'abstract texture',
  'abstract colorful shapes',
  'abstract light',
  'abstract waves',
  'abstract blur',
]

export const bannerRoutes = new Hono<AppEnv>().get(
  '/',
  requirePermission('core:system-design'),
  async (c) => {
    const key = c.env.PEXELS_API_KEY
    if (!key) return fail(c, 404, 'not_found')
    const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)] as T
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(pick(QUERIES))}&orientation=landscape&size=large&per_page=40&page=${1 + Math.floor(Math.random() * 4)}`,
        { headers: { authorization: key } },
      )
      if (!res.ok) return fail(c, 404, 'not_found')
      const photos = (
        (await res.json()) as {
          photos: { photographer: string; url: string; src: { large2x: string } }[]
        }
      ).photos
      if (!photos.length) return fail(c, 404, 'not_found')
      const p = pick(photos)
      c.header('cache-control', 'no-store')
      return c.json({ src: p.src.large2x, photographer: p.photographer, url: p.url })
    } catch {
      return fail(c, 404, 'not_found')
    }
  },
)
