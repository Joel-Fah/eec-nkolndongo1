/**
 * The daily meditation programme: passages as the parish prints them (« Amos 4, 1-13 », « Jean 7, 53–8, 11 »,
 * « Esaïe 63, 16-19; 64, 2-7 »), the CSV the parish's yearly calendar converts to, and its checks. References only: the
 * text of a passage is never stored here (decision 0032: only LSG 1910 / WEB may be quoted, and only where typed on purpose).
 */
import {
  BOOKS,
  type BookId,
  chapterCount,
  compareVerses,
  inRange,
  type VerseNo,
  verseCount,
} from './bible.ts'

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** « Soph. », « 1 Thess. », « Apoc. », « Esaïe » → the book, or null when it is unknown or ambiguous. */
export function bookFromToken(token: string): BookId | null {
  const t = fold(token)
  if (t.length < 3) return null
  const exact = BOOKS.filter((b) => fold(b.fr) === t || fold(b.en) === t)
  if (exact.length === 1) return (exact[0] as (typeof BOOKS)[number]).id
  const starts = BOOKS.filter((b) => fold(b.fr).startsWith(t) || fold(b.en).startsWith(t))
  return starts.length === 1 ? (starts[0] as (typeof BOOKS)[number]).id : null
}

export type Passage = {
  book: BookId | null /** what the parish wrote before the numbers (kept when the book is unknown) */
  name: string
  tail: string
}

/** Splits « Amos 4, 1-13 » into the book and « 4, 1-13 ». « 3 Jean 1-15 » keeps its leading number with the book. */
export function parsePassage(raw: string): Passage {
  const s = raw.replace(/\s+/g, ' ').trim()
  const lead = /^[123]\s?/.exec(s)?.[0].length ?? 0
  const cut = s.slice(lead).search(/\s\d/)
  const name = cut === -1 ? s : s.slice(0, lead + cut).trim()
  const tail = cut === -1 ? '' : s.slice(lead + cut).trim()
  return { book: bookFromToken(name), name, tail }
}

/** The verse part in the English way (« 4, 1-13 » → « 4:1-13 », « 63, 16-19; 64, 2-7 » → « 63:16-19; 64:2-7 »). */
const verses = (tail: string, locale: 'fr' | 'en') =>
  locale === 'en' ? tail.replace(/(\d+)\s*,\s*(?=\d)/g, '$1:') : tail

export function formatPassage(raw: string, locale: 'fr' | 'en'): string {
  const p = parsePassage(raw)
  const book = BOOKS.find((b) => b.id === p.book)
  const name = book ? book[locale] : p.name
  return `${name}${p.tail ? ` ${verses(p.tail, locale)}` : ''}`.trim()
}

export const formatPsalm = (tail: string, locale: 'fr' | 'en') =>
  `${locale === 'en' ? 'Psalm' : 'Psaume'} ${verses(tail.trim(), locale)}`.trim()

/** The shape of a passage as typed: digits, commas, semicolons, dashes, verse letters. */
export const PASSAGE_TAIL = /^\d[\d\s,;:–\-a-z]*$/i

/** Old Testament, New Testament (Acts, Revelation), Epistle (Romans… Jude), Gospel. A reading always has one. */
export const READING_LABELS = ['ot', 'nt', 'epistle', 'gospel'] as const
export type ReadingLabel = (typeof READING_LABELS)[number] | ''
export type Reading = { label: ReadingLabel; ref: string }

const LABEL_ALIASES: Record<string, ReadingLabel> = {
  'ancien testament': 'ot',
  'old testament': 'ot',
  'nouveau testament': 'nt',
  'new testament': 'nt',
  epitre: 'epistle',
  epistle: 'epistle',
  evangile: 'gospel',
  gospel: 'gospel',
}
/** « Ancien Testament », « Épître »… → the label; « Lecture » and anything else → '' (the book decides). */
export const labelFromText = (v: string): ReadingLabel => LABEL_ALIASES[fold(v)] ?? ''

const BOOK_ORDER = BOOKS.map((b) => b.id)
/** What a reading of this book is called: the book decides (Old Testament, Gospel, Epistle, or New Testament for Acts and Revelation). */
export function defaultLabel(book: BookId | null): ReadingLabel {
  if (!book) return ''
  const i = BOOK_ORDER.indexOf(book)
  if (i < BOOK_ORDER.indexOf('mat')) return 'ot'
  if (['mat', 'mrk', 'luk', 'jhn'].includes(book)) return 'gospel'
  if (book === 'act' || book === 'rev') return 'nt'
  return 'epistle'
}

// ——— Structured passages ————————————————————————————————————————
/** Books of one chapter only: « 3 Jean 1-15 » means verses 1 to 15 of the only chapter. */
export const SINGLE_CHAPTER: readonly BookId[] = ['oba', 'phm', '2jn', '3jn', 'jud']
export type Segment = {
  chapter: number
  from: VerseNo | null
  endChapter: number | null
  to: VerseNo | null
}
export type StructuredPassage = { book: BookId; segments: Segment[] }
const V = '(\\d{1,3}[a-z]?)'
const num = (v: string): VerseNo => (/^\d+$/.test(v) ? Number(v) : v.toLowerCase())

/** Reads the part after the book name: « 4, 1-13 », « 7, 53–8, 11 », « 63, 16-19; 64, 2-7 », « 3 » (a whole chapter). */
export function parseSegments(book: BookId, tail: string): Segment[] | null {
  const parts = tail
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const out: Segment[] = []
  for (const p of parts) {
    const cross = new RegExp(
      `^(\\d{1,3})\\s*,\\s*${V}\\s*[–-]\\s*(\\d{1,3})\\s*,\\s*${V}$`,
      'i',
    ).exec(p)
    const ranged = new RegExp(`^(\\d{1,3})\\s*,\\s*${V}(?:\\s*[–-]\\s*${V})?$`, 'i').exec(p)
    const single = SINGLE_CHAPTER.includes(book)
      ? new RegExp(`^${V}(?:\\s*[–-]\\s*${V})?$`, 'i').exec(p)
      : null
    const chapters = /^(\d{1,3})\s*[–-]\s*(\d{1,3})$/.exec(p)
    const whole = /^(\d{1,3})$/.exec(p)
    if (cross)
      out.push({
        chapter: Number(cross[1]),
        from: num(cross[2] as string),
        endChapter: Number(cross[3]),
        to: num(cross[4] as string),
      })
    else if (ranged)
      out.push({
        chapter: Number(ranged[1]),
        from: num(ranged[2] as string),
        endChapter: null,
        to: ranged[3] ? num(ranged[3]) : null,
      })
    else if (single)
      out.push({
        chapter: 1,
        from: num(single[1] as string),
        endChapter: null,
        to: single[2] ? num(single[2]) : null,
      })
    else if (chapters)
      out.push({
        chapter: Number(chapters[1]),
        from: null,
        endChapter: Number(chapters[2]),
        to: null,
      })
    else if (whole) out.push({ chapter: Number(whole[1]), from: null, endChapter: null, to: null })
    else return null
  }
  return out
}

export function parseStructured(raw: string): StructuredPassage | null {
  const p = parsePassage(raw)
  if (!p.book) return null
  const segments = parseSegments(p.book, p.tail)
  return segments ? { book: p.book, segments } : null
}

const segmentText = (book: BookId, s: Segment): string => {
  if (SINGLE_CHAPTER.includes(book) && s.chapter === 1 && !s.endChapter)
    return `${s.from ?? 1}${s.to ? `-${s.to}` : ''}`
  if (s.endChapter && s.from != null)
    return `${s.chapter}, ${s.from}–${s.endChapter}, ${s.to ?? ''}`.replace(/, $/, '')
  if (s.endChapter) return `${s.chapter}-${s.endChapter}`
  return `${s.chapter}${s.from != null ? `, ${s.from}${s.to ? `-${s.to}` : ''}` : ''}`
}
/** The canonical French text of a passage (what is stored): « Jean 7, 53–8, 11 ». */
export function formatStructured(p: StructuredPassage): string {
  const name = BOOKS.find((b) => b.id === p.book)?.fr ?? ''
  return `${name} ${p.segments.map((s) => segmentText(p.book, s)).join('; ')}`.trim()
}

export type RangeProblem = { code: 'bad_chapter' | 'bad_verse' | 'bad_order'; detail: string }
/** Every chapter and verse must exist (« 10a » counts as 10), and a range must go forward. */
export function checkPassage(p: StructuredPassage): RangeProblem | null {
  const name = BOOKS.find((b) => b.id === p.book)?.fr ?? p.book
  for (const s of p.segments) {
    const last = s.endChapter ?? s.chapter
    if (!inRange(p.book, s.chapter) || !inRange(p.book, last))
      return {
        code: 'bad_chapter',
        detail: `${name} ${Math.max(s.chapter, last)} (1–${chapterCount(p.book)})`,
      }
    if (last < s.chapter) return { code: 'bad_order', detail: formatStructured(p) }
    if (s.from != null && !inRange(p.book, s.chapter, s.from))
      return {
        code: 'bad_verse',
        detail: `${name} ${s.chapter}, ${s.from} (1–${verseCount(p.book, s.chapter)})`,
      }
    if (s.to != null && !inRange(p.book, last, s.to))
      return {
        code: 'bad_verse',
        detail: `${name} ${last}, ${s.to} (1–${verseCount(p.book, last)})`,
      }
    if (!s.endChapter && s.from != null && s.to != null && compareVerses(s.to, s.from) < 0)
      return { code: 'bad_order', detail: formatStructured(p) }
  }
  return null
}

// ——— The psalm ——————————————————————————————————————————————————
export type PsalmRef = { psalm: number; from: VerseNo | null; to: VerseNo | null }
/** « 89, 31-47 » → Psalm 89 verses 31 to 47; « 64 » → the whole of Psalm 64. Anything else (« 1-22 ») → null. */
export function parsePsalm(raw: string): PsalmRef | null {
  const t = raw.trim()
  const part = new RegExp(`^(\\d{1,3})\\s*,\\s*${V}(?:\\s*[–-]\\s*${V})?$`, 'i').exec(t)
  if (part)
    return {
      psalm: Number(part[1]),
      from: num(part[2] as string),
      to: part[3] ? num(part[3]) : null,
    }
  const whole = /^(\d{1,3})$/.exec(t)
  return whole ? { psalm: Number(whole[1]), from: null, to: null } : null
}
export const formatPsalmRef = (p: PsalmRef): string =>
  `${p.psalm}${p.from != null ? `, ${p.from}${p.to ? `-${p.to}` : ''}` : ''}`
export function checkPsalm(p: PsalmRef): RangeProblem | null {
  if (!inRange('psa', p.psalm)) return { code: 'bad_chapter', detail: `Psaume ${p.psalm} (1–150)` }
  for (const v of [p.from, p.to])
    if (v != null && !inRange('psa', p.psalm, v))
      return {
        code: 'bad_verse',
        detail: `Psaume ${p.psalm}, ${v} (1–${verseCount('psa', p.psalm)})`,
      }
  if (p.from != null && p.to != null && compareVerses(p.to, p.from) < 0)
    return { code: 'bad_order', detail: formatPsalmRef(p) }
  return null
}

// ——— CSV ————————————————————————————————————————————————————————
/** A small RFC 4180 reader: quoted fields with commas, doubled quotes, CRLF, a BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

export type MeditationRow = {
  date: string
  headline: string
  readings: Reading[]
  psalm: string
}
export type RowIssue = { line: number; level: 'error' | 'warning'; code: string; detail?: string }
export type ImportResult = {
  rows: (MeditationRow & { line: number; valid: boolean })[]
  issues: RowIssue[]
  ignored: string[]
}

const isDay = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) &&
  new Date(`${d}T00:00:00Z`).toISOString().startsWith(d)
const COLUMNS_IGNORED = ['reflection theme / meditations', 'status / completion', 'day']

/**
 * Reads the parish's calendar CSV (columns: Date, Day, Headline, Reading 1/2/3 Label + Ref, Psalm; the « Reflection Theme »
 * and « Status » columns, if present, are ignored). Every problem is reported with its line; nothing is guessed silently.
 */
export function readMeditationCsv(csv: string): ImportResult {
  const table = parseCsv(csv)
  const issues: RowIssue[] = []
  const head = (table[0] ?? []).map((h) => fold(h))
  const col = (name: string) => head.indexOf(fold(name))
  const iDate = col('date')
  const iHeadline = col('headline')
  const iPsalm = col('psalm')
  const slots = [1, 2, 3].map((n) => ({
    label: col(`reading ${n} label`),
    ref: col(`reading ${n} ref`),
  }))
  if (iDate === -1 || iPsalm === -1 || slots.some((s) => s.ref === -1))
    return { rows: [], issues: [{ line: 1, level: 'error', code: 'bad_header' }], ignored: [] }
  const ignored = (table[0] ?? []).filter((h) => COLUMNS_IGNORED.includes(fold(h)))
  const rows: ImportResult['rows'] = []
  const seen = new Set<string>()
  table.slice(1).forEach((cells, k) => {
    const line = k + 2
    const get = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '')
    const date = get(iDate)
    let valid = true
    const bad = (code: string, detail?: string, level: RowIssue['level'] = 'error') => {
      if (level === 'error') valid = false
      issues.push({ line, level, code, detail })
    }
    if (!isDay(date)) {
      bad('bad_date', date)
      return
    }
    if (seen.has(date)) bad('duplicate_date', date)
    seen.add(date)
    const readings: Reading[] = []
    for (const s of slots) {
      const ref = get(s.ref)
      if (!ref) continue
      const book = parsePassage(ref).book
      // The label from the file when it is one of ours; otherwise the book decides (« Lecture » becomes Old Testament for Isaiah…).
      readings.push({ label: labelFromText(get(s.label)) || defaultLabel(book), ref })
    }
    const psalm = get(iPsalm)
    if (readings.length === 0 && !psalm) {
      bad('empty_day', date)
      return
    }
    for (const r of readings) {
      const p = parsePassage(r.ref)
      if (!p.book) {
        bad('unknown_book', r.ref, 'warning')
        continue
      }
      const structured = parseStructured(r.ref)
      if (!structured) {
        bad('bad_ref', r.ref)
        continue
      }
      const problem = checkPassage(structured)
      if (problem) bad(problem.code, problem.detail)
    }
    if (psalm) {
      const ps = parsePsalm(psalm)
      if (ps) {
        const problem = checkPsalm(ps)
        if (problem) bad(problem.code, problem.detail)
      } else if (/^\d+\s*[-–]\s*\d+$/.test(psalm))
        // « 1-22 » alone could be verses of a psalm whose number was lost: to be checked by a person.
        bad('psalm_without_number', psalm, 'warning')
      else bad('bad_psalm', psalm)
    }
    rows.push({ line, date, headline: get(iHeadline), readings, psalm, valid })
  })
  return { rows, issues, ignored }
}
