/**
 * Date and time pickers (admin): a field that opens a calendar or two columns of hours and minutes, in the brand's own
 * look, instead of the browser's. Values stay plain strings (`YYYY-MM-DD`, `HH:mm`, `YYYY-MM-DDTHH:mm`), so they drop in
 * where the native inputs were. Base UI Popover gives focus handling and Esc; keys follow the ARIA grid pattern.
 * Strings come from the caller (packages/i18n); month and weekday names come from `Intl`.
 */
import { Popover } from '@base-ui/react/popover'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { type IconName, iconSvg } from '../src/icons.ts'

const cx = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(' ')
const DAY = 86_400_000

const Ico = ({ name, size = 20 }: { name: IconName; size?: 16 | 20 }) => (
  <span
    className="inline-flex"
    aria-hidden="true"
    // biome-ignore lint/security/noDangerouslySetInnerHtml: our own icon registry, no user input
    dangerouslySetInnerHTML={{ __html: iconSvg(name, { size }) }}
  />
)

export type PickerLabels = {
  /** « Choisir une date » / « Choisir une heure » (screen readers and the tooltip). */
  open: string
  prev: string
  next: string
  today: string
  clear: string
  /** « Choisir le mois » / « Choisir l’année »: the heading button. */
  chooseMonth: string
  chooseYear: string
  prevYears: string
  nextYears: string
  hour: string
  minute: string
  done: string
}

/* ── Date maths in UTC, so a time zone can never move a day ───────────── */
const parse = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(t).toISOString().slice(0, 10) === iso ? t : null
}
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => fmt((parse(iso) ?? 0) + n * DAY)
const addMonths = (iso: string, n: number) => {
  const d = new Date(parse(iso) ?? 0)
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate()
  return fmt(first + (Math.min(d.getUTCDate(), last) - 1) * DAY)
}
const todayIso = () => new Date().toISOString().slice(0, 10)
const clamp = (iso: string, min?: string, max?: string) =>
  min && iso < min ? min : max && iso > max ? max : iso
/** Monday = 0. */
const weekdayOf = (iso: string) => (new Date(parse(iso) ?? 0).getUTCDay() + 6) % 7

/* ── DatePicker ───────────────────────────────────────────────────────── */
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  locale,
  labels,
  placeholder,
  hint,
  disabled,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  locale: string
  labels: PickerLabels
  /** An example of the expected answer, shown while empty (e.g. « 25 octobre 2026 »). */
  placeholder: string
  hint?: string
  disabled?: boolean
  required?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const valid = parse(value) !== null
  const [cursor, setCursor] = useState(valid ? value : clamp(todayIso(), min, max))
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')
  const grid = useRef<HTMLDivElement>(null)
  const names = useMemo(() => {
    const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    const short = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
    const week = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
    return {
      months: Array.from({ length: 12 }, (_, i) => month.format(Date.UTC(2024, i, 1))),
      short: Array.from({ length: 12 }, (_, i) => short.format(Date.UTC(2024, i, 1))),
      // 2024-01-01 is a Monday.
      week: Array.from({ length: 7 }, (_, i) => week.format(Date.UTC(2024, 0, 1 + i))),
      weekLong: Array.from({ length: 7 }, (_, i) => long.format(Date.UTC(2024, 0, 1 + i))),
    }
  }, [locale])
  const shown = valid
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(parse(value) as number)
    : ''
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(parse(d) as number)
  const cy = Number(cursor.slice(0, 4))
  const cm = Number(cursor.slice(5, 7)) - 1
  const first = `${String(cy).padStart(4, '0')}-${String(cm + 1).padStart(2, '0')}-01`
  const lead = weekdayOf(first)
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead))
  const out = (d: string) => (min && d < min) || (max && d > max)
  const today = todayIso()

  // Focus follows the cursor inside the grid.
  useEffect(() => {
    if (!open || view !== 'days') return
    grid.current?.querySelector<HTMLButtonElement>(`[data-d="${cursor}"]`)?.focus()
  }, [open, view, cursor])
  const onOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setView('days')
      setCursor(valid ? clamp(value, min, max) : clamp(todayIso(), min, max))
    }
  }
  const pick = (d: string) => {
    if (out(d)) return
    onChange(d)
    setOpen(false)
  }
  const key = (e: React.KeyboardEvent) => {
    const step: Record<string, string> = {
      ArrowLeft: addDays(cursor, -1),
      ArrowRight: addDays(cursor, 1),
      ArrowUp: addDays(cursor, -7),
      ArrowDown: addDays(cursor, 7),
      Home: addDays(cursor, -weekdayOf(cursor)),
      End: addDays(cursor, 6 - weekdayOf(cursor)),
      PageUp: addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: addMonths(cursor, e.shiftKey ? 12 : 1),
    }
    const next = step[e.key]
    if (!next) return
    e.preventDefault()
    setCursor(clamp(next, min, max))
  }
  const yearsFrom = Math.floor(cy / 12) * 12

  return (
    <div className="field">
      <span className="field-label" id={`${id}-l`}>
        {label}
        {required ? ' *' : ''}
      </span>
      <Popover.Root open={open} onOpenChange={onOpen}>
        <div className="input-wrap">
          <Popover.Trigger
            className="input picker-trigger"
            data-icon=""
            disabled={disabled}
            aria-labelledby={`${id}-l`}
            aria-label={`${label}: ${shown || labels.open}`}
            data-empty={!valid || undefined}
          >
            {shown || placeholder}
          </Popover.Trigger>
          <span className="input-icon">
            <Ico name="calendarMinus" />
          </span>
        </div>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="eec-positioner">
            <Popover.Popup
              className="eec-popover eec-popup picker-pop"
              aria-label={label}
              onKeyDown={view === 'days' ? key : undefined}
            >
              <div className="picker-head">
                <button
                  type="button"
                  className="picker-nav"
                  aria-label={view === 'years' ? labels.prevYears : labels.prev}
                  onClick={() =>
                    setCursor(
                      view === 'years'
                        ? addMonths(cursor, -144)
                        : addMonths(cursor, view === 'months' ? -12 : -1),
                    )
                  }
                >
                  <Ico name="chevronLeft" />
                </button>
                <button
                  type="button"
                  className="picker-title"
                  aria-label={view === 'days' ? labels.chooseMonth : labels.chooseYear}
                  onClick={() =>
                    setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')
                  }
                >
                  {view === 'years'
                    ? `${yearsFrom} – ${yearsFrom + 11}`
                    : view === 'months'
                      ? cy
                      : `${names.months[cm]} ${cy}`}
                </button>
                <button
                  type="button"
                  className="picker-nav"
                  aria-label={view === 'years' ? labels.nextYears : labels.next}
                  onClick={() =>
                    setCursor(
                      view === 'years'
                        ? addMonths(cursor, 144)
                        : addMonths(cursor, view === 'months' ? 12 : 1),
                    )
                  }
                >
                  <Ico name="chevronRight" />
                </button>
              </div>
              {view === 'days' && (
                <div ref={grid}>
                  <div className="picker-week">
                    {names.week.map((w) => (
                      <span key={w} aria-hidden="true">
                        {w.replace('.', '')}
                      </span>
                    ))}
                  </div>
                  <div className="picker-days">
                    {days.map((d) => {
                      const inMonth = Number(d.slice(5, 7)) - 1 === cm
                      return (
                        <button
                          key={d}
                          type="button"
                          data-d={d}
                          tabIndex={d === cursor ? 0 : -1}
                          className="picker-day"
                          data-out-month={!inMonth || undefined}
                          data-today={d === today || undefined}
                          aria-pressed={d === value}
                          aria-label={dayLabel(d)}
                          aria-current={d === today ? 'date' : undefined}
                          disabled={!!out(d)}
                          onClick={() => pick(d)}
                        >
                          {Number(d.slice(8, 10))}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {view === 'months' && (
                <div className="picker-cells">
                  {names.short.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      className="picker-cell"
                      aria-pressed={i === cm}
                      onClick={() => {
                        setCursor(clamp(addMonths(cursor, i - cm), min, max))
                        setView('days')
                      }}
                    >
                      {m.replace('.', '')}
                    </button>
                  ))}
                </div>
              )}
              {view === 'years' && (
                <div className="picker-cells">
                  {Array.from({ length: 12 }, (_, i) => yearsFrom + i).map((y) => (
                    <button
                      key={y}
                      type="button"
                      className="picker-cell"
                      aria-pressed={y === cy}
                      disabled={
                        (!!min && y < Number(min.slice(0, 4))) ||
                        (!!max && y > Number(max.slice(0, 4)))
                      }
                      onClick={() => {
                        setCursor(clamp(addMonths(cursor, (y - cy) * 12), min, max))
                        setView('months')
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
              <div className="picker-foot">
                <button
                  type="button"
                  className="picker-link"
                  disabled={!!out(today)}
                  onClick={() => pick(today)}
                >
                  {labels.today}
                </button>
                {!required && value && (
                  <button
                    type="button"
                    className="picker-link"
                    onClick={() => {
                      onChange('')
                      setOpen(false)
                    }}
                  >
                    {labels.clear}
                  </button>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

/* ── TimePicker ───────────────────────────────────────────────────────── */
export function TimePicker({
  label,
  value,
  onChange,
  step = 5,
  labels,
  placeholder,
  hint,
  disabled,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  /** Minutes between the proposed values (5 by default). */
  step?: number
  labels: PickerLabels
  placeholder: string
  hint?: string
  disabled?: boolean
  required?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  const hh = m?.[1] ?? ''
  const mm = m?.[2] ?? ''
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) =>
    String(i * step).padStart(2, '0'),
  )
  const cols = useRef<HTMLDivElement>(null)
  // Bring the chosen values into view when the panel opens.
  useEffect(() => {
    if (!open) return
    for (const el of cols.current?.querySelectorAll<HTMLElement>('[aria-pressed="true"]') ?? [])
      el.scrollIntoView({ block: 'center' })
  }, [open])
  const set = (h: string, min: string) => onChange(`${h || '08'}:${min || '00'}`)
  const move = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const list = [...(e.currentTarget.parentElement?.querySelectorAll('button') ?? [])]
    const next = list[list.indexOf(e.currentTarget) + dir] as HTMLButtonElement | undefined
    next?.focus()
  }
  return (
    <div className="field">
      <span className="field-label" id={`${id}-l`}>
        {label}
        {required ? ' *' : ''}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <div className="input-wrap">
          <Popover.Trigger
            className="input picker-trigger"
            data-icon=""
            disabled={disabled}
            aria-labelledby={`${id}-l`}
            aria-label={`${label}: ${m ? value : labels.open}`}
            data-empty={!m || undefined}
          >
            {m ? value : placeholder}
          </Popover.Trigger>
          <span className="input-icon">
            <Ico name="time" />
          </span>
        </div>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="eec-positioner">
            <Popover.Popup
              className="eec-popover eec-popup picker-pop picker-time"
              aria-label={label}
            >
              <div className="picker-cols" ref={cols}>
                <fieldset className="picker-col">
                  <legend className="sr-only">{labels.hour}</legend>
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={h === hh}
                      className="picker-cell"
                      onKeyDown={move}
                      onClick={() => set(h, mm)}
                    >
                      {h}
                    </button>
                  ))}
                </fieldset>
                <fieldset className="picker-col">
                  <legend className="sr-only">{labels.minute}</legend>
                  {minutes.map((x) => (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={x === mm}
                      className="picker-cell"
                      onKeyDown={move}
                      onClick={() => {
                        set(hh, x)
                        if (hh) setOpen(false)
                      }}
                    >
                      {x}
                    </button>
                  ))}
                </fieldset>
              </div>
              <div className="picker-foot">
                <button type="button" className="picker-link" onClick={() => setOpen(false)}>
                  {labels.done}
                </button>
                {!required && value && (
                  <button
                    type="button"
                    className="picker-link"
                    onClick={() => {
                      onChange('')
                      setOpen(false)
                    }}
                  >
                    {labels.clear}
                  </button>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

/* ── DateTimePicker: both, side by side, as one `YYYY-MM-DDTHH:mm` value ─ */
export function DateTimePicker({
  label,
  timeLabel,
  value,
  onChange,
  min,
  max,
  locale,
  labels,
  datePlaceholder,
  timePlaceholder,
  hint,
  disabled,
  className,
}: {
  label: string
  timeLabel: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  locale: string
  labels: PickerLabels
  datePlaceholder: string
  timePlaceholder: string
  hint?: string
  disabled?: boolean
  className?: string
}) {
  const [d = '', t = ''] = value.split('T')
  const join = (date: string, time: string) => (date ? `${date}T${time || '09:00'}` : '')
  return (
    <div className={cx('grid gap-2', className)}>
      <div className="picker-pair">
        <DatePicker
          label={label}
          value={d}
          onChange={(x) => onChange(join(x, t))}
          min={min}
          max={max}
          locale={locale}
          labels={labels}
          placeholder={datePlaceholder}
          disabled={disabled}
        />
        <TimePicker
          label={timeLabel}
          value={t}
          onChange={(x) => onChange(d ? join(d, x) : '')}
          labels={labels}
          placeholder={timePlaceholder}
          disabled={disabled || !d}
        />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}
