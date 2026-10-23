/**
 * One Bible passage as fields: the book, then the chapter, « De » and « À » (verses). The fields follow the book: the chapter
 * cannot go past the book's last chapter, a verse cannot go past the chapter's last verse (« 10a » counts as 10), so a passage
 * that does not exist (« Jean 140 : 173 ») cannot be typed. A preview line under ALL the fields shows how it will read.
 */
import { useLocale } from '@eec/admin-kit'
import {
  type BibleRef,
  BOOKS,
  type BookId,
  chapterCount,
  compareVerses,
  formatRef,
  type VerseNo,
  verseCount,
} from '@eec/core'
import { Button, Icon, SelectField } from '@eec/ui/react'

/** « 10a » stays « 10a »; digits above the limit become the limit; anything unreadable → null. */
export function clampVerse(raw: string, max: number): VerseNo | null {
  const v = raw
    .toLowerCase()
    .replace(/[^0-9a-z]/g, '')
    .replace(/^(\d{0,3})(\d*)([a-z]?).*$/, '$1$3')
  if (!/^\d/.test(v)) return null
  const digits = Math.min(Number(v.replace(/\D/g, '')), max || 999)
  const letter = v.replace(/\d/g, '')
  return letter ? `${digits}${letter}` : digits
}
export const clampChapter = (raw: string, max: number): number =>
  Math.min(Math.max(Number(raw.replace(/\D/g, '')) || 1, 1), max)

type Labels = {
  book: string
  chapter: string
  from: string
  to: string
  remove: string
  order: string
}

export function ChapterVerseFields({
  book,
  chapter,
  from,
  to,
  onChange,
  disabled,
  labels,
  idPrefix,
  showFrom = true,
  showTo = true,
}: {
  book: BookId
  chapter: number
  from: VerseNo | null | undefined
  to: VerseNo | null | undefined
  onChange: (patch: { chapter?: number; from?: VerseNo | null; to?: VerseNo | null }) => void
  disabled?: boolean
  labels: Pick<Labels, 'chapter' | 'from' | 'to'>
  idPrefix: string
  showFrom?: boolean
  showTo?: boolean
}) {
  const chapters = chapterCount(book)
  const verses = verseCount(book, chapter)
  const bad = from != null && to != null && to !== '' && compareVerses(to, from) < 0
  return (
    <>
      <label className="reading-num" htmlFor={`${idPrefix}-c`}>
        <span className="field-label">{labels.chapter}</span>
        <input
          id={`${idPrefix}-c`}
          className="input"
          inputMode="numeric"
          maxLength={3}
          placeholder={`1–${chapters}`}
          disabled={disabled}
          value={chapter}
          onChange={(e) => {
            const c = clampChapter(e.target.value, chapters)
            // The verses must still exist in the new chapter.
            const max = verseCount(book, c)
            onChange({
              chapter: c,
              ...(from != null && clampVerse(String(from), max) !== from
                ? { from: clampVerse(String(from), max) }
                : {}),
              ...(to != null && clampVerse(String(to), max) !== to
                ? { to: clampVerse(String(to), max) }
                : {}),
            })
          }}
        />
      </label>
      {showFrom && (
        <label className="reading-num" htmlFor={`${idPrefix}-f`}>
          <span className="field-label">{labels.from}</span>
          <input
            id={`${idPrefix}-f`}
            className="input"
            maxLength={4}
            placeholder={`1–${verses}`}
            aria-invalid={bad}
            disabled={disabled}
            value={from ?? ''}
            onChange={(e) => onChange({ from: clampVerse(e.target.value, verses) })}
          />
        </label>
      )}
      {showTo && (
        <label className="reading-num" htmlFor={`${idPrefix}-t`}>
          <span className="field-label">{labels.to}</span>
          <input
            id={`${idPrefix}-t`}
            className="input"
            maxLength={4}
            placeholder={`1–${verses}`}
            aria-invalid={bad}
            disabled={disabled}
            value={to ?? ''}
            onChange={(e) => onChange({ to: clampVerse(e.target.value, verses) })}
          />
        </label>
      )}
    </>
  )
}

export function RefEditor({
  value,
  onChange,
  onRemove,
  disabled,
  idPrefix,
}: {
  value: BibleRef
  onChange: (next: BibleRef) => void
  onRemove?: () => void
  disabled?: boolean
  idPrefix: string
}) {
  const { t, locale } = useLocale()
  const labels = {
    book: t('content.passage.book'),
    chapter: t('content.passage.chapter'),
    from: t('content.passage.from'),
    to: t('content.passage.to'),
    remove: t('content.passage.remove'),
    order: t('content.passage.order'),
  }
  const bad =
    value.from != null &&
    value.to != null &&
    value.to !== '' &&
    compareVerses(value.to, value.from) < 0
  return (
    <div className="reading-box" data-invalid={bad ? '' : undefined}>
      <div className="reading-row">
        <div className="reading-book">
          <SelectField
            label={labels.book}
            value={value.book}
            onValueChange={(v) => {
              if (!v) return
              const book = v as BookId
              const chapter = Math.min(value.chapter, chapterCount(book))
              const max = verseCount(book, chapter)
              onChange({
                book,
                chapter,
                from: value.from != null ? clampVerse(String(value.from), max) : null,
                to: value.to != null ? clampVerse(String(value.to), max) : null,
              })
            }}
            options={BOOKS.map((b) => ({ value: b.id, label: locale === 'en' ? b.en : b.fr }))}
          />
        </div>
        <ChapterVerseFields
          book={value.book}
          chapter={value.chapter}
          from={value.from}
          to={value.to}
          disabled={disabled}
          labels={labels}
          idPrefix={idPrefix}
          onChange={(patch) => onChange({ ...value, ...patch })}
        />
        {onRemove && !disabled && (
          <Button
            variant="secondary"
            className="reading-remove"
            aria-label={labels.remove}
            onClick={onRemove}
          >
            <Icon name="close" size={20} />
          </Button>
        )}
      </div>
      {bad ? (
        <p className="field-error" role="alert">
          {labels.order}
        </p>
      ) : (
        <p className="reading-preview">
          <Icon name="bookText" size={16} />
          {formatRef(value, locale === 'en' ? 'en' : 'fr')}
        </p>
      )}
    </div>
  )
}
