/**
 * The passage fields of a day: a reading is a kind, a book, then chapter / from / to (more parts for « Esaïe 63, 16-19; 64, 2-7 »,
 * and an end chapter for « Jean 7, 53–8, 11 »); the psalm is a number and, if it is a part, from / to. What is stored stays the
 * parish's own text; the fields follow the book, so a chapter or verse that does not exist cannot be typed.
 */
import { useLocale } from '@eec/admin-kit'
import { ChapterVerseFields } from '@eec/content-kit'
import {
  BOOKS,
  type BookId,
  chapterCount,
  checkPassage,
  checkPsalm,
  defaultLabel,
  formatPassage,
  formatPsalm,
  formatPsalmRef,
  formatStructured,
  parsePsalm,
  parseStructured,
  READING_LABELS,
  type Reading,
  type Segment,
  SINGLE_CHAPTER,
  type StructuredPassage,
} from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import { Button, Icon, SelectField, TextField } from '@eec/ui/react'

const k = (key: string) => `meditations.${key}` as MessageKey
const MAX_PARTS = 3

const blankSegment = (book: BookId): Segment => ({
  chapter: 1,
  from: SINGLE_CHAPTER.includes(book) ? 1 : null,
  endChapter: null,
  to: null,
})

export function ReadingEditor({
  value,
  onChange,
  onRemove,
  disabled,
  idPrefix,
}: {
  value: Reading
  onChange: (next: Reading) => void
  onRemove: () => void
  disabled?: boolean
  idPrefix: string
}) {
  const { t, locale } = useLocale()
  const lang = locale === 'en' ? 'en' : 'fr'
  const sp = parseStructured(value.ref)
  const problem = sp ? checkPassage(sp) : null
  const unreadable = !sp && value.ref.trim() !== ''
  const labels = {
    chapter: t('content.passage.chapter'),
    from: t('content.passage.from'),
    to: t('content.passage.to'),
  }
  const write = (p: StructuredPassage) => onChange({ label: value.label, ref: formatStructured(p) })
  const setSegment = (i: number, patch: Partial<Segment>) => {
    if (!sp) return
    write({ ...sp, segments: sp.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  }
  const pickBook = (book: BookId) => {
    const kept = sp?.segments.length ? { book, segments: sp.segments } : null
    const next = kept && !checkPassage(kept) ? kept : { book, segments: [blankSegment(book)] }
    onChange({ label: defaultLabel(book), ref: formatStructured(next) })
  }
  const bad = problem !== null
  return (
    <div className="reading-box" data-invalid={bad || unreadable ? '' : undefined}>
      <div className="reading-row">
        <div className="reading-kind">
          <SelectField
            label={t(k('reading_label'))}
            value={value.label}
            placeholder="—"
            onValueChange={(x) => x && onChange({ ...value, label: x as Reading['label'] })}
            options={READING_LABELS.map((l) => ({ value: l, label: t(k(`label_${l}`)) }))}
          />
        </div>
        <div className="reading-book">
          <SelectField
            label={t('content.passage.book')}
            value={sp?.book ?? ''}
            placeholder={t(k('pick_book'))}
            onValueChange={(x) => x && pickBook(x as BookId)}
            options={BOOKS.map((b) => ({ value: b.id, label: b[lang] }))}
          />
        </div>
        {!disabled && (
          <Button
            variant="secondary"
            className="reading-remove"
            aria-label={t(k('remove'))}
            onClick={onRemove}
          >
            <Icon name="close" size={20} />
          </Button>
        )}
      </div>
      {sp?.segments.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: edited in place
        <div key={i} className="reading-row">
          <ChapterVerseFields
            book={sp.book}
            chapter={s.chapter}
            from={s.from}
            to={s.to}
            showTo={!s.endChapter}
            disabled={disabled}
            labels={labels}
            idPrefix={`${idPrefix}-${i}`}
            onChange={(patch) => setSegment(i, patch)}
          />
          {s.endChapter != null && (
            <>
              <span className="reading-until" aria-hidden="true">
                →
              </span>
              <ChapterVerseFields
                book={sp.book}
                chapter={s.endChapter}
                from={null}
                to={s.to}
                showFrom={false}
                disabled={disabled}
                labels={labels}
                idPrefix={`${idPrefix}-${i}-end`}
                onChange={(patch) =>
                  setSegment(i, {
                    ...(patch.chapter !== undefined ? { endChapter: patch.chapter } : {}),
                    ...(patch.to !== undefined ? { to: patch.to } : {}),
                  })
                }
              />
            </>
          )}
          {!disabled && (
            <div className="reading-part-actions">
              {s.endChapter == null && chapterCount(sp.book) > s.chapter ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSegment(i, { endChapter: s.chapter + 1, to: null })}
                >
                  {t(k('until_chapter'))}
                </Button>
              ) : s.endChapter != null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSegment(i, { endChapter: null, to: null })}
                >
                  {t(k('one_chapter'))}
                </Button>
              ) : null}
              {sp.segments.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t(k('remove'))}
                  onClick={() => write({ ...sp, segments: sp.segments.filter((_, j) => j !== i) })}
                >
                  <Icon name="close" size={16} />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
      {sp && !disabled && sp.segments.length < MAX_PARTS && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => write({ ...sp, segments: [...sp.segments, blankSegment(sp.book)] })}
          >
            <Icon name="plus" size={16} />
            {t(k('add_part'))}
          </Button>
        </div>
      )}
      {problem ? (
        <p className="field-error" role="alert">
          {t(k(`issue_${problem.code}`), { d: problem.detail })}
        </p>
      ) : unreadable ? (
        <p className="field-error" role="alert">
          {t(k('issue_bad_ref'), { d: value.ref })}
        </p>
      ) : sp ? (
        <p className="reading-preview">
          <Icon name="bookText" size={16} />
          {formatPassage(formatStructured(sp), lang)}
        </p>
      ) : null}
    </div>
  )
}

export function PsalmEditor({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const { t, locale } = useLocale()
  const lang = locale === 'en' ? 'en' : 'fr'
  const p = parsePsalm(value)
  const problem = p ? checkPsalm(p) : null
  const labels = {
    chapter: t(k('psalm_number')),
    from: t('content.passage.from'),
    to: t('content.passage.to'),
  }
  if (!value.trim() && !p)
    return disabled ? null : (
      <div>
        <Button variant="secondary" size="sm" onClick={() => onChange('1')}>
          <Icon name="plus" size={16} />
          {t(k('add_psalm'))}
        </Button>
      </div>
    )
  return (
    <div className="reading-box" data-invalid={problem || !p ? '' : undefined}>
      <div className="reading-row">
        {p ? (
          <ChapterVerseFields
            book="psa"
            chapter={p.psalm}
            from={p.from}
            to={p.to}
            disabled={disabled}
            labels={labels}
            idPrefix="psalm"
            onChange={(patch) => {
              const next = { ...p, ...patch, psalm: patch.chapter ?? p.psalm }
              onChange(
                formatPsalmRef({ psalm: next.psalm, from: next.from ?? null, to: next.to ?? null }),
              )
            }}
          />
        ) : (
          <TextField
            label={t(k('psalm'))}
            placeholder={t(k('psalm_ph'))}
            value={value}
            disabled={disabled}
            onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
          />
        )}
        {!disabled && (
          <Button
            variant="secondary"
            className="reading-remove"
            aria-label={t(k('remove'))}
            onClick={() => onChange('')}
          >
            <Icon name="close" size={20} />
          </Button>
        )}
      </div>
      {problem ? (
        <p className="field-error" role="alert">
          {t(k(`issue_${problem.code}`), { d: problem.detail })}
        </p>
      ) : !p ? (
        <p className="field-error" role="alert">
          {t(k('issue_bad_psalm'), { d: value })}
        </p>
      ) : (
        <p className="reading-preview">
          <Icon name="bookText" size={16} />
          {formatPsalm(formatPsalmRef(p), lang)}
        </p>
      )}
    </div>
  )
}
