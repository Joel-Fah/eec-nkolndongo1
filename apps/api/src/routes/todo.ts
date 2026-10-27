/**
 * « À faire »: what is waiting for the signed-in person, as counts, filtered by what they may see. One small endpoint
 * for the admin home; tables are read by name (this is a roll-up across modules, not a module). Nothing here is public.
 */
import { type AppEnv, requireSelf } from '@eec/api-kit'
import { canAnywhere, type Principal, scopeFor } from '@eec/auth'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'

const TZ = 'Africa/Douala'
/** The next `n` Sundays (YYYY-MM-DD), counting today if it is one. */
export function nextSundays(now: Date, n: number): string[] {
  const local = new Date(
    `${new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)}T00:00:00Z`,
  )
  const first = new Date(local.getTime() + ((7 - local.getUTCDay()) % 7) * 86_400_000)
  return Array.from({ length: n }, (_, i) =>
    new Date(first.getTime() + i * 7 * 86_400_000).toISOString().slice(0, 10),
  )
}

export const todoRoutes = new Hono<AppEnv>().get('/', requireSelf(), async (c) => {
  const actor = await c.var.deps.actor()
  const p = actor?.principal as Principal
  const db = await c.var.deps.db()
  const may = (perm: string) => canAnywhere(p, perm)
  const num = async (q: ReturnType<typeof sql>) =>
    Number((await db.execute<{ n: number }>(q)).rows[0]?.n ?? 0)
  const me = actor?.userId
  const out: Record<string, unknown> = {}

  if (may('news:read') || may('events:read') || may('guides:read')) {
    out.drafts = {
      news: may('news:read')
        ? await num(
            sql`select count(*)::int as n from news_posts where state = 'draft' and created_by = ${me}`,
          )
        : null,
      events: may('events:read')
        ? await num(
            sql`select count(*)::int as n from events_items where state = 'draft' and created_by = ${me}`,
          )
        : null,
      guides: may('guides:read')
        ? await num(sql`select count(*)::int as n from guides where state = 'draft'`)
        : null,
    }
    out.scheduled = {
      news: may('news:read')
        ? await num(
            sql`select count(*)::int as n from news_posts where state = 'published' and publish_at > now() and publish_at < now() + interval '7 days'`,
          )
        : null,
      events: may('events:read')
        ? await num(
            sql`select count(*)::int as n from events_items where state = 'published' and publish_at > now() and publish_at < now() + interval '7 days'`,
          )
        : null,
    }
    out.missingEn = {
      news: may('news:read')
        ? await num(
            sql`select count(*)::int as n from news_posts where state = 'published' and title_en = ''`,
          )
        : null,
      events: may('events:read')
        ? await num(
            sql`select count(*)::int as n from events_items where state = 'published' and title_en = ''`,
          )
        : null,
      guides: may('guides:read')
        ? await num(
            sql`select count(*)::int as n from guides where state = 'published' and title_en = ''`,
          )
        : null,
    }
  }
  // Colleagues asking this person to publish their news or events (they are closed when the item is published).
  const asked = await db.execute<{ entity: string; n: number }>(
    sql`select params->>'entity' as entity, count(*)::int as n from notifications
      where user_id = ${me} and kind = 'publish_request' and resolved_at is null and dismissed_at is null
      group by 1`,
  )
  out.publishRequests = {
    news: asked.rows.find((r) => r.entity === 'news')?.n ?? 0,
    events: asked.rows.find((r) => r.entity === 'events')?.n ?? 0,
  }
  // A leader's join requests waiting for an answer, in the groups they lead.
  if (may('core:group-members')) {
    const scope = scopeFor(p, 'core:group-members')
    out.joinRequests =
      scope === 'all'
        ? await num(sql`select count(*)::int as n from group_requests where status = 'pending'`)
        : scope.length
          ? await num(
              sql`select count(*)::int as n from group_requests where status = 'pending' and group_id in (${sql.join(
                scope.map((g) => sql`${g}::uuid`),
                sql`, `,
              )})`,
            )
          : 0
  }
  // Communion cards: a second person's approval, and baptisms declared but not yet confirmed.
  if (may('communion:approve'))
    out.cardsToApprove = await num(
      sql`select count(*)::int as n from communion_cards where status = 'proposed' and proposed_by is distinct from ${me}`,
    )
  if (may('communion:issue'))
    out.baptismsToConfirm = await num(
      sql`select count(*)::int as n from profiles p
        where (p.baptised = true or p.confirmed = true) and p.sacrament_confirmed_at is null
          and not exists (select 1 from communion_cards c where c.user_id = p.user_id)`,
    )
  if (may('liturgy:read')) {
    const days = nextSundays(new Date(), 4)
    const rows = await db.execute<{ date: string }>(
      sql`select date from liturgy_sundays where state = 'published' and date in (${sql.join(
        days.map((d) => sql`${d}`),
        sql`, `,
      )})`,
    )
    const have = new Set(rows.rows.map((r) => r.date))
    out.emptySundays = days.filter((d) => !have.has(d))
  }
  if (may('schedule:read'))
    out.unvalidatedSlots = await num(
      sql`select count(*)::int as n from schedule_slots where validated = false`,
    )
  if (may('contact:read')) {
    out.oldestMessageHours = await num(
      may('contact:read-sensitive')
        ? sql`select coalesce(extract(epoch from now() - min(created_at)) / 3600, 0)::int as n from contact_messages where status = 'new'`
        : sql`select coalesce(extract(epoch from now() - min(created_at)) / 3600, 0)::int as n from contact_messages where status = 'new' and sensitive = false`,
    )
    out.newMessages = await num(
      may('contact:read-sensitive')
        ? sql`select count(*)::int as n from contact_messages where status = 'new'`
        : sql`select count(*)::int as n from contact_messages where status = 'new' and sensitive = false`,
    )
  }
  return c.json(out)
})
