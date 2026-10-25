/**
 * `pnpm bible:seed` — loads the Louis Segond 1910 text (public domain) into `bible_verses`, so staff can prefill the verse of the
 * day in French. Downloads the file once (7 MB, not kept in the repo). Safe to run again: it replaces the translation.
 */
import { BOOKS } from '@eec/core'
import { assertBranch, confirmNotDev, connectDirect } from '@eec/db/node'
import { sql } from 'drizzle-orm'

const URL_LSG =
  'https://raw.githubusercontent.com/juliend2/data-bible/refs/heads/master/db/seed_data/louis-segond-formatted.json'
type Json = {
  Copyright?: string
  Testaments: { Books: { Chapters: { Verses: { Text: string }[] }[] }[] }[]
}

const branch = assertBranch(['dev', 'production'])
await confirmNotDev('Loading the Louis Segond text')
const res = await fetch(URL_LSG)
if (!res.ok) throw new Error(`download failed: ${res.status}`)
const data = (await res.json()) as Json
if (!/domaine public/i.test(data.Copyright ?? ''))
  throw new Error('the file is not marked public domain: stopping')
const books = data.Testaments.flatMap((t) => t.Books)
if (books.length !== BOOKS.length)
  throw new Error(`expected ${BOOKS.length} books, found ${books.length}`)

const rows: { book: string; chapter: number; verse: number; text: string }[] = []
for (const [bi, b] of books.entries()) {
  const id = BOOKS[bi]?.id as string
  for (const [ci, c] of b.Chapters.entries())
    for (const [vi, v] of c.Verses.entries())
      rows.push({
        book: id,
        chapter: ci + 1,
        verse: vi + 1,
        text: v.Text.replace(/\s+/g, ' ').trim(),
      })
}

const { db, close } = await connectDirect()
await db.execute(sql`delete from bible_verses where translation = 'lsg'`)
for (let i = 0; i < rows.length; i += 2000) {
  const part = rows.slice(i, i + 2000)
  const json = JSON.stringify(part.map((r) => ({ b: r.book, c: r.chapter, v: r.verse, t: r.text })))
  await db.execute(sql`
    insert into bible_verses (translation, book, chapter, verse, text)
    select 'lsg', x.b, x.c, x.v, x.t
    from jsonb_to_recordset(${json}::jsonb) as x(b text, c int, v int, t text)`)
}
await close()
console.log(`Loaded ${rows.length} verses of Louis Segond 1910 into Neon branch "${branch}".`)
