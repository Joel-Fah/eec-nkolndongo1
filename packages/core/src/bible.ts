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

export type BibleRef = { book: BookId; chapter: number; from?: number | null; to?: number | null }

export const isBookId = (v: unknown): v is BookId => BOOKS.some((b) => b.id === v)

/** « Matthieu 11 : 28 » (French spacing) or « Matthew 11:28–30 ». */
export function formatRef(ref: BibleRef, locale: 'fr' | 'en'): string {
  const book = BOOKS.find((b) => b.id === ref.book)
  if (!book) return ''
  const name = book[locale]
  const colon = locale === 'fr' ? ' : ' : ':'
  if (!ref.from) return `${name} ${ref.chapter}`
  const verses = ref.to && ref.to > ref.from ? `${ref.from}–${ref.to}` : `${ref.from}`
  return `${name} ${ref.chapter}${colon}${verses}`
}

/** Checks what an editor typed. Returns a clean reference or null. */
export function cleanRef(raw: unknown): BibleRef | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isBookId(r.book)) return null
  const int = (v: unknown, max: number) =>
    Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max ? (v as number) : null
  const chapter = int(r.chapter, 150)
  if (!chapter) return null
  const from = r.from == null ? null : int(r.from, 176)
  const to = r.to == null ? null : int(r.to, 176)
  if (r.from != null && !from) return null
  if (r.to != null && (!to || !from || to < from)) return null
  return { book: r.book, chapter, from, to }
}
