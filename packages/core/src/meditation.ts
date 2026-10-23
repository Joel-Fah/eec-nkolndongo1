/**
 * The daily meditation programme: passages as the parish prints them (« Amos 4, 1-13 », « Jean 7, 53–8, 11 »,
 * « Esaïe 63, 16-19; 64, 2-7 »), the CSV the parish's yearly calendar converts to, and its checks. References only: the
 * text of a passage is never stored here (decision 0032: only LSG 1910 / WEB may be quoted, and only where typed on purpose).
 */
import { BOOKS, type BookId } from './bible.ts'

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

export const READING_LABELS = ['ot', 'epistle', 'gospel', 'reading'] as const
export type ReadingLabel = (typeof READING_LABELS)[number] | ''
export type Reading = { label: ReadingLabel; ref: string }

const LABEL_ALIASES: Record<string, ReadingLabel> = {
  'ancien testament': 'ot',
  'old testament': 'ot',
  epitre: 'epistle',
  epistle: 'epistle',
  evangile: 'gospel',
  gospel: 'gospel',
  lecture: 'reading',
  reading: 'reading',
}
export const labelFromText = (v: string): ReadingLabel => LABEL_ALIASES[fold(v)] ?? ''

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
  rows: (MeditationRow & { line: number })[]
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
    const bad = (code: string, detail?: string, level: RowIssue['level'] = 'error') =>
      issues.push({ line, level, code, detail })
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
      readings.push({ label: labelFromText(get(s.label)), ref })
    }
    const psalm = get(iPsalm)
    if (readings.length === 0 && !psalm) {
      bad('empty_day', date)
      return
    }
    for (const r of readings) {
      const p = parsePassage(r.ref)
      if (!p.book) bad('unknown_book', r.ref, 'warning')
      if (p.tail && !PASSAGE_TAIL.test(p.tail)) bad('bad_ref', r.ref)
    }
    if (psalm && !PASSAGE_TAIL.test(psalm)) bad('bad_psalm', psalm)
    // « 1-22 » alone could be verses of a psalm whose number was lost: to be checked by a person.
    else if (/^\d+\s*[-–]\s*\d+$/.test(psalm)) bad('psalm_without_number', psalm, 'warning')
    rows.push({ line, date, headline: get(iHeadline), readings, psalm })
  })
  return { rows, issues, ignored }
}
