/**
 * Site search, mounted at /api/search: public, cached per normalised query for a minute. Only cold queries reach the
 * database, and those are rate-limited per client address (hashed by the limiter key's owner, never stored with a user).
 */
import { type AppEnv, cachedJson, clientIp, publicRoute, versionFor } from '@eec/api-kit'
import { allow } from '@eec/auth'
import { closestTitles, normaliseQuery, searchPublic, suggestions } from '@eec/modules/search'
import { Hono } from 'hono'

const AREAS = ['news', 'events', 'sermons', 'guides', 'departments']

export const searchRoutes = new Hono<AppEnv>()
  .get(
    '/',
    publicRoute(
      'Public full-text search over published content; cached, rate-limited when uncached',
    ),
    async (c) => {
      const q = normaliseQuery(c.req.query('q'))
      const locale = c.req.query('locale') === 'en' ? 'en' : 'fr'
      if (!q) return c.json({ q: '', items: [] })
      const versions = await Promise.all(
        AREAS.map((a) => versionFor(c.var.deps.db, a, c.var.deps.timeoutMs)),
      )
      return cachedJson(c, {
        key: `search/${locale}/${encodeURIComponent(q.toLowerCase())}/v${versions.join('.')}`,
        ttl: 60,
        keep: 60 * 60,
        load: async (db) => {
          // Only a cold query costs a database round trip, so only those count against the limit.
          if (!(await allow(db, `search:${clientIp(c)}`, 30, 60))) throw new Error('rate_limited')
          const items = await searchPublic(db, q, locale)
          return { q, items, didYouMean: items.length ? [] : await closestTitles(db, q, locale) }
        },
      })
    },
  )
  // What to try when the box is empty: real things from the site. Edge-cached for five minutes.
  .get(
    '/suggest',
    publicRoute('Public suggestions for the empty search box; cached'),
    async (c) => {
      const locale = c.req.query('locale') === 'en' ? 'en' : 'fr'
      const versions = await Promise.all(
        AREAS.map((a) => versionFor(c.var.deps.db, a, c.var.deps.timeoutMs)),
      )
      return cachedJson(c, {
        key: `search/suggest/${locale}/v${versions.join('.')}`,
        ttl: 300,
        keep: 60 * 60 * 24,
        load: (db) => suggestions(db, locale),
      })
    },
  )
