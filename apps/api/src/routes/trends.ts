/**
 * Trends for the admin home: twelve calendar months of what the parish team does and receives, as counts, filtered by what
 * the signed-in person may see. Tables are read by name (a roll-up across modules). Nothing here is public.
 */
import { type AppEnv, requireSelf } from '@eec/api-kit'
import { canAnywhere, type Principal } from '@eec/auth'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'

export const trendsRoutes = new Hono<AppEnv>().get('/', requireSelf(), async (c) => {
  const actor = await c.var.deps.actor()
  const p = actor?.principal as Principal
  const db = await c.var.deps.db()
  const may = (perm: string) => canAnywhere(p, perm)
  const months = (
    await db.execute<{ m: string }>(
      sql`select to_char(m, 'YYYY-MM') as m from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m order by m`,
    )
  ).rows.map((r) => r.m)
  const series = async (table: string, stamp: string, where = 'true') =>
    (
      await db.execute<{ m: string; n: number }>(
        sql.raw(
          `select to_char(s.m, 'YYYY-MM') as m, count(t.*)::int as n
           from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') s(m)
           left join ${table} t on date_trunc('month', ${stamp}) = s.m and ${where}
           group by s.m order by s.m`,
        ),
      )
    ).rows.map((r) => r.n)
  const out: Record<string, unknown> = { months }
  if (may('contact:read')) {
    const sens = may('contact:read-sensitive')
    out.messages = await series(
      'contact_messages',
      't.created_at',
      sens ? 'true' : 't.sensitive = false',
    )
    const cats = await db.execute<{ category: string; n: number }>(
      sql.raw(
        `select category, count(*)::int as n from contact_messages where created_at > now() - interval '90 days' ${sens ? '' : 'and sensitive = false'} group by category order by n desc`,
      ),
    )
    out.messagesByCategory = cats.rows
  }
  if (may('news:read'))
    out.news = await series(
      'news_posts',
      'coalesce(t.first_published_at, t.created_at)',
      "t.state = 'published'",
    )
  if (may('events:read'))
    out.events = await series(
      'events_items',
      'coalesce(t.first_published_at, t.created_at)',
      "t.state = 'published'",
    )
  if (may('media:read')) out.media = await series('media_files', 't.created_at')
  return c.json(out)
})
