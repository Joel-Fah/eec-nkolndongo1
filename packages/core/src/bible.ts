/**
 * Bible references as data (book, chapter, verses), shown in the reader's language. Book names follow the
 * Louis Segond (French) and World English Bible (English) usage; abbreviations are the common short forms.
 * No verse text lives here: texts are typed from the agreed public-domain translations (decision 0032).
 */
export type BookId = (typeof BOOKS)[number]['id']

export const BOOKS = [
  { id: 'gen', fr: 'Genèse', en: 'Genesis' },
  { id: 'exo', fr: 'Exode', en: 'Exodus' },
  { id: 'lev', fr: 'Lévitique', en: 'Leviticus' },
  { id: 'num', fr: 'Nombres', en: 'Numbers' },
  { id: 'deu', fr: 'Deutéronome', en: 'Deuteronomy' },
  { id: 'jos', fr: 'Josué', en: 'Joshua' },
  { id: 'jdg', fr: 'Juges', en: 'Judges' },
  { id: 'rut', fr: 'Ruth', en: 'Ruth' },
  { id: '1sa', fr: '1 Samuel', en: '1 Samuel' },
  { id: '2sa', fr: '2 Samuel', en: '2 Samuel' },
  { id: '1ki', fr: '1 Rois', en: '1 Kings' },
  { id: '2ki', fr: '2 Rois', en: '2 Kings' },
  { id: '1ch', fr: '1 Chroniques', en: '1 Chronicles' },
  { id: '2ch', fr: '2 Chroniques', en: '2 Chronicles' },
  { id: 'ezr', fr: 'Esdras', en: 'Ezra' },
  { id: 'neh', fr: 'Néhémie', en: 'Nehemiah' },
  { id: 'est', fr: 'Esther', en: 'Esther' },
  { id: 'job', fr: 'Job', en: 'Job' },
  { id: 'psa', fr: 'Psaumes', en: 'Psalms' },
  { id: 'pro', fr: 'Proverbes', en: 'Proverbs' },
  { id: 'ecc', fr: 'Ecclésiaste', en: 'Ecclesiastes' },
  { id: 'sng', fr: 'Cantique des cantiques', en: 'Song of Solomon' },
  { id: 'isa', fr: 'Ésaïe', en: 'Isaiah' },
  { id: 'jer', fr: 'Jérémie', en: 'Jeremiah' },
  { id: 'lam', fr: 'Lamentations', en: 'Lamentations' },
  { id: 'ezk', fr: 'Ézéchiel', en: 'Ezekiel' },
  { id: 'dan', fr: 'Daniel', en: 'Daniel' },
  { id: 'hos', fr: 'Osée', en: 'Hosea' },
  { id: 'jol', fr: 'Joël', en: 'Joel' },
  { id: 'amo', fr: 'Amos', en: 'Amos' },
  { id: 'oba', fr: 'Abdias', en: 'Obadiah' },
  { id: 'jon', fr: 'Jonas', en: 'Jonah' },
  { id: 'mic', fr: 'Michée', en: 'Micah' },
  { id: 'nam', fr: 'Nahum', en: 'Nahum' },
  { id: 'hab', fr: 'Habacuc', en: 'Habakkuk' },
  { id: 'zep', fr: 'Sophonie', en: 'Zephaniah' },
  { id: 'hag', fr: 'Aggée', en: 'Haggai' },
  { id: 'zec', fr: 'Zacharie', en: 'Zechariah' },
  { id: 'mal', fr: 'Malachie', en: 'Malachi' },
  { id: 'mat', fr: 'Matthieu', en: 'Matthew' },
  { id: 'mrk', fr: 'Marc', en: 'Mark' },
  { id: 'luk', fr: 'Luc', en: 'Luke' },
  { id: 'jhn', fr: 'Jean', en: 'John' },
  { id: 'act', fr: 'Actes', en: 'Acts' },
  { id: 'rom', fr: 'Romains', en: 'Romans' },
  { id: '1co', fr: '1 Corinthiens', en: '1 Corinthians' },
  { id: '2co', fr: '2 Corinthiens', en: '2 Corinthians' },
  { id: 'gal', fr: 'Galates', en: 'Galatians' },
  { id: 'eph', fr: 'Éphésiens', en: 'Ephesians' },
  { id: 'php', fr: 'Philippiens', en: 'Philippians' },
  { id: 'col', fr: 'Colossiens', en: 'Colossians' },
  { id: '1th', fr: '1 Thessaloniciens', en: '1 Thessalonians' },
  { id: '2th', fr: '2 Thessaloniciens', en: '2 Thessalonians' },
  { id: '1ti', fr: '1 Timothée', en: '1 Timothy' },
  { id: '2ti', fr: '2 Timothée', en: '2 Timothy' },
  { id: 'tit', fr: 'Tite', en: 'Titus' },
  { id: 'phm', fr: 'Philémon', en: 'Philemon' },
  { id: 'heb', fr: 'Hébreux', en: 'Hebrews' },
  { id: 'jas', fr: 'Jacques', en: 'James' },
  { id: '1pe', fr: '1 Pierre', en: '1 Peter' },
  { id: '2pe', fr: '2 Pierre', en: '2 Peter' },
  { id: '1jn', fr: '1 Jean', en: '1 John' },
  { id: '2jn', fr: '2 Jean', en: '2 John' },
  { id: '3jn', fr: '3 Jean', en: '3 John' },
  { id: 'jud', fr: 'Jude', en: 'Jude' },
  { id: 'rev', fr: 'Apocalypse', en: 'Revelation' },
] as const

/** A verse number, with an optional part letter: 16, « 1b ». Up to three digits. */
export type VerseNo = number | string
export type BibleRef = { book: BookId; chapter: number; from?: VerseNo | null; to?: VerseNo | null }

const VERSE = /^(\d{1,3})([a-z])?$/i
/** Digits and the letter of a verse number (« 1b » → [1, 'b']). */
const parts = (v: VerseNo): [number, string] => {
  const m = VERSE.exec(String(v))
  return m ? [Number(m[1]), (m[2] ?? '').toLowerCase()] : [0, '']
}
/** Orders verse numbers: 1 < 1a < 1b < 2. */
export function compareVerses(a: VerseNo, b: VerseNo): number {
  const [na, la] = parts(a)
  const [nb, lb] = parts(b)
  return na - nb || la.localeCompare(lb)
}
/** « 16 », « 1b »; anything else (empty, 4 digits, two letters) → null. */
export function cleanVerse(v: unknown): VerseNo | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const m = VERSE.exec(String(v).trim())
  if (!m || Number(m[1]) < 1) return null
  return m[2] ? `${Number(m[1])}${m[2].toLowerCase()}` : Number(m[1])
}

export const isBookId = (v: unknown): v is BookId => BOOKS.some((b) => b.id === v)

/** « Matthieu 11 : 28 » (French spacing) or « Matthew 11:28–30 ». */
export function formatRef(ref: BibleRef, locale: 'fr' | 'en'): string {
  const book = BOOKS.find((b) => b.id === ref.book)
  if (!book) return ''
  const name = book[locale]
  const colon = locale === 'fr' ? ' : ' : ':'
  if (!ref.from) return `${name} ${ref.chapter}`
  const verses =
    ref.to && compareVerses(ref.to, ref.from) > 0 ? `${ref.from}–${ref.to}` : `${ref.from}`
  return `${name} ${ref.chapter}${colon}${verses}`
}

/** Checks what an editor typed. Returns a clean reference or null. */
export function cleanRef(raw: unknown): BibleRef | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isBookId(r.book)) return null
  const chapter =
    Number.isInteger(r.chapter) && (r.chapter as number) >= 1 && (r.chapter as number) <= 150
      ? (r.chapter as number)
      : null
  if (!chapter) return null
  const blank = (v: unknown) => v == null || v === ''
  const from = blank(r.from) ? null : cleanVerse(r.from)
  const to = blank(r.to) ? null : cleanVerse(r.to)
  if (!blank(r.from) && from === null) return null
  if (!blank(r.to) && (to === null || from === null || compareVerses(to, from) < 0)) return null
  return { book: r.book, chapter, from, to }
}
