/**
 * Site search (decision 0030): Postgres full-text search, accent-insensitive (unaccent), French or English
 * configuration by the visitor's language, over what is public — live news, published events, published guides and
 * department pages. Static pages are matched by the web app from its own page list. Nothing is logged with a user.
 * Lives in the registry package (it reads several modules' tables), not in a module.
 */
import { plainText } from '@eec/core'
import type { Db } from '@eec/db'
import { eventsItems } from '@eec/module-events/schema'
import { guides } from '@eec/module-guides/schema'
import { newsPosts } from '@eec/module-news/schema'
import { sql } from 'drizzle-orm'

export type Locale = 'fr' | 'en'
export type SearchHit = {
  type: 'news' | 'events' | 'guides' | 'departments'
  key: string
  title: string
  snippet: string
  rank: number
}

/** Trimmed, one space between words, at most 80 characters; null when too short to search. */
export function normaliseQuery(raw: string | undefined): string | null {
  const q = (raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 80)
  return q.length >= 2 ? q : null
}

/** A short excerpt around the first matching word, accent- and case-insensitive; the caller escapes and highlights. */
export function excerptAround(text: string, q: string, size = 160): string {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const flat = text.replace(/\s+/g, ' ').trim()
  const hay = fold(flat)
  const words = fold(q)
    .split(' ')
    .filter((w) => w.length >= 2)
  let at = -1
  for (const w of words) {
    const i = hay.indexOf(w)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return flat.slice(0, size)
  const from = Math.max(0, at - 40)
  const piece = flat.slice(from, from + size)
  return `${from > 0 ? '…' : ''}${piece}${from + size < flat.length ? '…' : ''}`
}

type Row = {
  type: SearchHit['type']
  key: string
  title: string
  excerpt: string | null
  body: unknown
  rank: number
}

export async function searchPublic(
  db: Db,
  q: string,
  locale: Locale,
  limit = 20,
): Promise<SearchHit[]> {
  const cfg = locale === 'en' ? sql`'english'::regconfig` : sql`'french'::regconfig`
  const en = locale === 'en'
  const tsq = sql`websearch_to_tsquery(${cfg}, unaccent(${q}))`
  const doc = (title: ReturnType<typeof sql>, ...rest: ReturnType<typeof sql>[]) =>
    sql`to_tsvector(${cfg}, unaccent(coalesce(${title}, '') || ' ' || ${sql.join(
      rest.map((r) => sql`coalesce(${r}, '')`),
      sql` || ' ' || `,
    )}))`
  const text = (col: ReturnType<typeof sql>) =>
    sql`coalesce(jsonb_path_query_array(${col}, '$.**.text')::text, '')`

  const news = sql`
    select 'news' as type, slug as key,
      ${en ? sql`coalesce(nullif(title_en, ''), title_fr)` : sql`title_fr`} as title,
      ${en ? sql`coalesce(nullif(excerpt_en, ''), excerpt_fr)` : sql`excerpt_fr`} as excerpt,
      ${en ? sql`case when title_en <> '' then body_en else body_fr end` : sql`body_fr`} as body,
      ts_rank(${doc(
        en ? sql`coalesce(nullif(title_en, ''), title_fr)` : sql`title_fr`,
        en ? sql`coalesce(nullif(excerpt_en, ''), excerpt_fr)` : sql`excerpt_fr`,
        text(en ? sql`case when title_en <> '' then body_en else body_fr end` : sql`body_fr`),
      )}, ${tsq}) as rank
    from ${newsPosts}
    where state = 'published' and (publish_at is null or publish_at <= now()) and (unpublish_at is null or unpublish_at > now())`
  const events = sql`
    select 'events' as type, slug as key,
      ${en ? sql`coalesce(nullif(title_en, ''), title_fr)` : sql`title_fr`} as title,
      null as excerpt,
      ${en ? sql`case when title_en <> '' then description_en else description_fr end` : sql`description_fr`} as body,
      ts_rank(${doc(
        en ? sql`coalesce(nullif(title_en, ''), title_fr)` : sql`title_fr`,
        text(
          en
            ? sql`case when title_en <> '' then description_en else description_fr end`
            : sql`description_fr`,
        ),
      )}, ${tsq}) as rank
    from ${eventsItems}
    where state = 'published' and (publish_at is null or publish_at <= now()) and (unpublish_at is null or unpublish_at > now())`
  const guideRows = sql`
    select 'guides' as type, slug as key,
      ${en ? sql`coalesce(nullif(title_en, ''), title_fr)` : sql`title_fr`} as title,
      ${en ? sql`coalesce(nullif(intro_en, ''), intro_fr)` : sql`intro_fr`} as excerpt,
      null as body,
      ts_rank(${doc(
        en ? sql`coalesce(nullif(title_en, ''), title_fr)` : sql`title_fr`,
        en ? sql`coalesce(nullif(intro_en, ''), intro_fr)` : sql`intro_fr`,
      )}, ${tsq}) as rank
    from ${guides}
    where state = 'published'`
  const departments = sql`
    select 'departments' as type, g.key as key,
      ${en ? sql`coalesce(nullif(g.name_en, ''), g.name_fr)` : sql`g.name_fr`} as title,
      ${en ? sql`coalesce(nullif(p.tagline_en, ''), p.tagline_fr)` : sql`p.tagline_fr`} as excerpt,
      ${en ? sql`case when p.tagline_en <> '' then p.body_en else p.body_fr end` : sql`p.body_fr`} as body,
      ts_rank(${doc(
        en ? sql`coalesce(nullif(g.name_en, ''), g.name_fr)` : sql`g.name_fr`,
        en ? sql`coalesce(nullif(p.tagline_en, ''), p.tagline_fr)` : sql`p.tagline_fr`,
        text(
          en ? sql`case when p.tagline_en <> '' then p.body_en else p.body_fr end` : sql`p.body_fr`,
        ),
      )}, ${tsq}) as rank
    from department_pages p join groups g on g.id = p.group_id
    where p.state = 'published' and g.is_active`

  const result = await db.execute<Row>(sql`
    select * from (${news} union all ${events} union all ${guideRows} union all ${departments}) r
    where rank > 0
    order by rank desc, title asc
    limit ${limit}`)
  return result.rows.map((r) => ({
    type: r.type,
    key: r.key,
    title: r.title,
    snippet:
      excerptAround(r.body ? plainText(r.body as never) : (r.excerpt ?? ''), q) ||
      (r.excerpt ?? ''),
    rank: Number(r.rank),
  }))
}
