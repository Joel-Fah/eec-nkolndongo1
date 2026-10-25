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
import { sermons } from '@eec/module-sermons/schema'
import { sql } from 'drizzle-orm'

export type Locale = 'fr' | 'en'
export type SearchHit = {
  type: 'news' | 'events' | 'guides' | 'departments' | 'sermons'
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
type S = ReturnType<typeof sql>

/** The same four sources for search, suggestions and « did you mean », written once per language. */
function sources(locale: Locale) {
  const en = locale === 'en'
  const t = (fr: string, enCol: string) =>
    en ? sql.raw(`coalesce(nullif(${enCol}, ''), ${fr})`) : sql.raw(fr)
  const body = (frCol: string, enCol: string, flag: string) =>
    en ? sql.raw(`case when ${flag} <> '' then ${enCol} else ${frCol} end`) : sql.raw(frCol)
  return [
    {
      type: 'news',
      from: sql`${newsPosts}`,
      where: sql`state = 'published' and (publish_at is null or publish_at <= now()) and (unpublish_at is null or unpublish_at > now())`,
      key: sql`slug`,
      title: t('title_fr', 'title_en'),
      excerpt: t('excerpt_fr', 'excerpt_en'),
      body: body('body_fr', 'body_en', 'title_en'),
    },
    {
      type: 'events',
      from: sql`${eventsItems}`,
      where: sql`state = 'published' and (publish_at is null or publish_at <= now()) and (unpublish_at is null or unpublish_at > now())`,
      key: sql`slug`,
      title: t('title_fr', 'title_en'),
      excerpt: sql`null::text`,
      body: body('description_fr', 'description_en', 'title_en'),
    },
    {
      type: 'sermons',
      from: sql`${sermons}`,
      where: sql`state = 'published' and (publish_at is null or publish_at <= now()) and (unpublish_at is null or unpublish_at > now())`,
      key: sql`slug`,
      title: t('title_fr', 'title_en'),
      excerpt: t('summary_fr', 'summary_en'),
      body: body('body_fr', 'body_en', 'title_en'),
    },
    {
      type: 'guides',
      from: sql`${guides}`,
      where: sql`state = 'published'`,
      key: sql`slug`,
      title: t('title_fr', 'title_en'),
      excerpt: t('intro_fr', 'intro_en'),
      body: sql`null::jsonb`,
    },
    {
      type: 'departments',
      from: sql`department_pages p join groups g on g.id = p.group_id`,
      where: sql`p.state = 'published' and g.is_active`,
      key: sql`g.key`,
      title: en ? sql`coalesce(nullif(g.name_en, ''), g.name_fr)` : sql`g.name_fr`,
      excerpt: en ? sql`coalesce(nullif(p.tagline_en, ''), p.tagline_fr)` : sql`p.tagline_fr`,
      body: en
        ? sql`case when p.tagline_en <> '' then p.body_en else p.body_fr end`
        : sql`p.body_fr`,
    },
  ] as { type: SearchHit['type']; from: S; where: S; key: S; title: S; excerpt: S; body: S }[]
}

const unionOf = (parts: S[]) => sql.join(parts, sql` union all `)

export async function searchPublic(
  db: Db,
  q: string,
  locale: Locale,
  limit = 20,
): Promise<SearchHit[]> {
  const cfg = locale === 'en' ? sql`'english'::regconfig` : sql`'french'::regconfig`
  const tsq = sql`websearch_to_tsquery(${cfg}, unaccent(${q}))`
  // Typo tolerance (pg_trgm): a word that is almost a word of the title still matches (« chorael » finds « Chorale »).
  const fuzzy = q.length >= 4
  const parts = sources(locale).map(
    (s) => sql`
    select ${s.type} as type, ${s.key} as key, ${s.title} as title, ${s.excerpt} as excerpt, ${s.body} as body,
      ts_rank(to_tsvector(${cfg}, unaccent(coalesce(${s.title}, '') || ' ' || coalesce(${s.excerpt}, '') || ' ' || coalesce(jsonb_path_query_array(${s.body}, '$.**.text')::text, ''))), ${tsq})
      ${fuzzy ? sql`+ case when word_similarity(unaccent(lower(${q})), unaccent(lower(${s.title}))) >= 0.5 then word_similarity(unaccent(lower(${q})), unaccent(lower(${s.title}))) * 0.6 else 0 end` : sql``}
      as rank
    from ${s.from} where ${s.where}`,
  )
  const result = await db.execute<Row>(sql`
    select * from (${unionOf(parts)}) r
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

/** When nothing matches: the closest titles (« did you mean »), by trigram similarity. */
export async function closestTitles(
  db: Db,
  q: string,
  locale: Locale,
  limit = 4,
): Promise<string[]> {
  if (q.length < 3) return []
  const parts = sources(locale).map(
    (s) =>
      sql`select ${s.title} as title, word_similarity(unaccent(lower(${q})), unaccent(lower(${s.title}))) as sim from ${s.from} where ${s.where}`,
  )
  const r = await db.execute<{ title: string; sim: number }>(
    sql`select title, sim from (${unionOf(parts)}) r where sim >= 0.3 order by sim desc, title asc limit ${limit}`,
  )
  return r.rows.map((x) => x.title)
}

export type Suggestions = {
  guides: { key: string; title: string }[]
  departments: { key: string; title: string }[]
  news: { key: string; title: string }[]
  event: { key: string; title: string } | null
}

/** What to try when the box is empty: a few real things from the site (published only), newest or next first. */
export async function suggestions(db: Db, locale: Locale): Promise<Suggestions> {
  const src = sources(locale)
  const pick = async (type: SearchHit['type'], order: S, n: number) => {
    const s = src.find((x) => x.type === type)
    if (!s) return []
    const r = await db.execute<{ key: string; title: string }>(
      sql`select ${s.key} as key, ${s.title} as title from ${s.from} where ${s.where} order by ${order} limit ${n}`,
    )
    return r.rows
  }
  const [guideRows, deptRows, newsRows, eventRows] = await Promise.all([
    pick('guides', sql`sort_order asc, title_fr asc`, 3),
    pick('departments', sql`p.sort_order asc, g.name_fr asc`, 3),
    pick('news', sql`coalesce(publish_at, first_published_at, created_at) desc`, 2),
    pick('events', sql`starts_at asc`, 1),
  ])
  return { guides: guideRows, departments: deptRows, news: newsRows, event: eventRows[0] ?? null }
}
