/**
 * Meditations (admin, /m/meditations): the programmes, the days of a programme (a month at a time, a row each, opened in
 * place to edit), and the import of the parish's yearly calendar from a CSV, checked line by line before anything is saved.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog, RefEditor } from '@eec/content-kit'
import {
  type BibleRef,
  checkPassage,
  checkPsalm,
  formatPassage,
  formatPsalm,
  formatStructured,
  type ImportResult,
  parsePsalm,
  parseStructured,
  type Reading,
  readMeditationCsv,
} from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  SelectField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { PsalmEditor, ReadingEditor } from './passages.tsx'

type Plan = {
  id: string
  slug: string
  titleFr: string
  titleEn: string
  descriptionFr: string
  descriptionEn: string
  startsOn: string
  endsOn: string
  state: 'draft' | 'published'
  days: number
  firstDay: string | null
  lastDay: string | null
}
type Day = {
  id: string
  date: string
  headlineFr: string
  headlineEn: string
  readings: Reading[]
  psalm: string
  reflectionFr: string
  reflectionEn: string
  verseRef: string
  verseFr: string
  verseEn: string
}

const k = (key: string) => `meditations.${key}` as MessageKey
/** « 1 juil. 2026 »: a day written for the screen's language. */
const dayFormat = (locale: string) => (d: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${d}T12:00:00Z`))
/** The days a programme really covers: from its first to its last day, or the planned dates while it is empty. */
const covered = (p: Plan) => ({ from: p.firstDay ?? p.startsOn, to: p.lastDay ?? p.endsOn })
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })

export default function MeditationsPage() {
  const [openId, setOpenId] = useState<string | null>(() => location.hash.slice(1) || null)
  useEffect(() => {
    const onHash = () => setOpenId(location.hash.slice(1) || null)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const open = (id: string | null) => {
    history.replaceState(null, '', id ? `#${id}` : location.pathname + location.search)
    setOpenId(id)
  }
  return openId ? <PlanView id={openId} onBack={() => open(null)} /> : <Plans onOpen={open} />
}

/* ── Plans ────────────────────────────────────────────────────────────── */
function Plans({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const year = new Date().getFullYear()
  const [v, setV] = useState({
    titleFr: '',
    titleEn: '',
    startsOn: `${year}-01-01`,
    endsOn: `${year}-12-31`,
  })
  const list = useQuery({
    queryKey: ['meditation-plans'],
    queryFn: () => api<{ items: Plan[] }>('/meditations/plans'),
  })
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/meditations/plans', { method: 'POST', body: v }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['meditation-plans'] })
      onOpen(r.id)
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const fmt = dayFormat(locale)
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {hasPermission(me, 'meditations:edit') && !creating && (
          <Button onClick={() => setCreating(true)}>{t(k('new_plan'))}</Button>
        )}
      </header>
      {creating && (
        <div className="admin-panel grid gap-3">
          <TextField
            label={t(k('plan_title_fr'))}
            placeholder="Méditations 2026"
            value={v.titleFr}
            onChange={(e: { target: { value: string } }) =>
              setV((x) => ({ ...x, titleFr: e.target.value }))
            }
          />
          <TextField
            label={t(k('plan_title_en'))}
            placeholder="Meditations 2026"
            value={v.titleEn}
            onChange={(e: { target: { value: string } }) =>
              setV((x) => ({ ...x, titleEn: e.target.value }))
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t(k('starts_on'))}
              type="date"
              placeholder=""
              value={v.startsOn}
              onChange={(e: { target: { value: string } }) =>
                setV((x) => ({ ...x, startsOn: e.target.value }))
              }
            />
            <TextField
              label={t(k('ends_on'))}
              type="date"
              placeholder=""
              value={v.endsOn}
              onChange={(e: { target: { value: string } }) =>
                setV((x) => ({ ...x, endsOn: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              loading={create.isPending}
              disabled={!v.titleFr.trim() || !v.startsOn || !v.endsOn || v.startsOn > v.endsOn}
              onClick={() => create.mutate()}
            >
              {t(k('create'))}
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t(k('cancel'))}
            </Button>
          </div>
        </div>
      )}
      {list.data && list.data.items.length === 0 && !creating ? (
        <EmptyState title={t(k('plans_empty_t'))} text={t(k('plans_empty_p'))} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(list.data?.items ?? []).map((p) => (
            <li key={p.id}>
              <button type="button" className="admin-panel plan-tile" onClick={() => onOpen(p.id)}>
                <Badge tone={p.state === 'published' ? 'success' : 'warning'}>
                  {t(k(`status_${p.state}`))}
                </Badge>
                <strong className="font-display text-2xl">
                  {(locale === 'en' && p.titleEn) || p.titleFr}
                </strong>
                <span className="text-sm text-ink-muted">
                  {fmt(covered(p).from)} → {fmt(covered(p).to)} ·{' '}
                  {t(k('days_count'), { n: String(p.days) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── One plan ─────────────────────────────────────────────────────────── */
function PlanView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'meditations:edit')
  const canPublish = hasPermission(me, 'meditations:publish')
  const canDelete = hasPermission(me, 'meditations:delete')
  const plans = useQuery({
    queryKey: ['meditation-plans'],
    queryFn: () => api<{ items: Plan[] }>('/meditations/plans'),
  })
  const plan = plans.data?.items.find((p) => p.id === id)
  const [confirm, setConfirm] = useState(false)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['meditation-plans'] })
    qc.invalidateQueries({ queryKey: ['meditation-days', id] })
  }
  const state = useMutation({
    mutationFn: (to: 'publish' | 'unpublish') =>
      api(`/meditations/plans/${id}/${to}`, { method: 'POST' }).then(() => to),
    onSuccess: (to) => {
      say(t(k(to === 'publish' ? 'published_t' : 'unpublished_t')))
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const del = useMutation({
    mutationFn: () => api(`/meditations/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('deleted')))
      refresh()
      onBack()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  if (plans.data && !plan) return <EmptyState title={t(k('plans_empty_t'))} text="" />
  if (!plan) return <div className="admin-panel" aria-busy="true" />
  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
          {t(k('back'))}
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <Badge tone={plan.state === 'published' ? 'success' : 'warning'}>
            {t(k(`status_${plan.state}`))}
          </Badge>
          <h1 className="text-4xl">{(locale === 'en' && plan.titleEn) || plan.titleFr}</h1>
          <p className="text-ink-muted">
            {dayFormat(locale)(covered(plan).from)} → {dayFormat(locale)(covered(plan).to)} ·{' '}
            {t(k('days_count'), { n: String(plan.days) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPublish && (
            <Button
              variant={plan.state === 'published' ? 'secondary' : 'primary'}
              loading={state.isPending}
              onClick={() => state.mutate(plan.state === 'published' ? 'unpublish' : 'publish')}
            >
              {t(k(plan.state === 'published' ? 'unpublish' : 'publish'))}
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              {t(k('delete'))}
            </Button>
          )}
        </div>
      </header>
      {canPublish && plan.state === 'draft' && (
        <p className="text-sm text-ink-muted">{t(k('publish_help'))}</p>
      )}
      <TabsBox
        tabs={[
          { id: 'days', label: t(k('tab_days')), content: <Days plan={plan} canEdit={canEdit} /> },
          ...(canEdit
            ? [
                {
                  id: 'import',
                  label: t(k('tab_import')),
                  content: <ImportPanel plan={plan} onDone={refresh} />,
                },
              ]
            : []),
        ]}
      />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t(k('delete_t'))}
        text={t(k('delete_p'))}
        confirmLabel={t(k('delete'))}
        danger
        busy={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  )
}

/* ── Days of a plan: a month at a time ───────────────────────────────── */
function Days({ plan, canEdit }: { plan: Plan; canEdit: boolean }) {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const [month, setMonth] = useState('')
  const [openDate, setOpenDate] = useState<string | null>(null)
  // The form of the last opened day stays mounted while it folds, so closing animates too.
  const [mounted, setMounted] = useState<string | null>(null)
  const toggle = (date: string | null) => {
    setOpenDate(date)
    if (date) setMounted(date)
  }
  const [adding, setAdding] = useState('')
  const q = useQuery({
    queryKey: ['meditation-days', plan.id, month],
    queryFn: () =>
      api<{ items: Day[]; months: string[] }>(
        `/meditations/plans/${plan.id}/days${month ? `?month=${month}` : ''}`,
      ),
  })
  // Start on the current month of the plan once its months are known.
  useEffect(() => {
    if (!month && q.data?.months.length) {
      const now = new Date().toISOString().slice(0, 7)
      setMonth(q.data.months.includes(now) ? now : (q.data.months[0] as string))
    }
  }, [q.data, month])
  const monthLabel = (m: string) => {
    const s = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${m}-01T12:00:00Z`))
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  const weekday = (d: string) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(`${d}T12:00:00Z`),
    )
  const dayNo = (d: string) => String(Number(d.slice(8)))
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
  const items = q.data?.items ?? []
  const shown =
    adding && !items.some((d) => d.date === adding)
      ? [...items, blankDay(adding)].sort((a, b) => a.date.localeCompare(b.date))
      : items
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {q.data && q.data.months.length > 0 && (
          <div className="media-select">
            <SelectField
              label={t(k('month'))}
              value={month}
              onValueChange={(v) => v && setMonth(v)}
              options={q.data.months.map((m) => ({ value: m, label: monthLabel(m) }))}
            />
          </div>
        )}
        {canEdit && (
          <TextField
            label={t(k('add_day'))}
            type="date"
            placeholder=""
            min={plan.startsOn}
            max={plan.endsOn}
            value={adding}
            onChange={(e: { target: { value: string } }) => {
              setAdding(e.target.value)
              toggle(e.target.value || null)
            }}
          />
        )}
      </div>
      {q.data && shown.length === 0 ? (
        <EmptyState title={t(k('no_days_t'))} text={t(k('no_days_p'))} />
      ) : (
        <ul className="med-days">
          {shown.map((d) => (
            <li key={d.date} className="med-row" data-open={openDate === d.date ? '' : undefined}>
              <button
                type="button"
                className="med-head"
                aria-expanded={openDate === d.date}
                onClick={() => toggle(openDate === d.date ? null : d.date)}
              >
                <span className="med-date">
                  {weekday(d.date)} <b>{dayNo(d.date)}</b>
                  {d.date === today && <Badge tone="info">{t(k('today'))}</Badge>}
                </span>
                <span className="med-main">
                  <span className="med-headline">{d.headlineFr}</span>
                  <span className="med-readings">
                    {d.readings.map((r, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a static list
                      <span key={i}>{formatPassage(r.ref, locale)}</span>
                    ))}
                  </span>
                </span>
                <span className="med-psalm">{d.psalm ? formatPsalm(d.psalm, locale) : ''}</span>
                <Icon name="chevronDown" size={16} />
              </button>
              <div className="med-collapse" data-open={openDate === d.date ? '' : undefined}>
                <div className="med-collapse-inner" inert={openDate !== d.date}>
                  {mounted === d.date && (
                    <DayForm
                      key={d.date}
                      planId={plan.id}
                      day={d}
                      canEdit={canEdit}
                      onDone={() => {
                        toggle(null)
                        setAdding('')
                        qc.invalidateQueries({ queryKey: ['meditation-days', plan.id] })
                        qc.invalidateQueries({ queryKey: ['meditation-plans'] })
                      }}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The first verse of a passage (« Amos 4, 1-13 » → « Amos 4, 1 »): a verse of the day is one verse, the editor can widen it. */
function firstVerse(ref: string): string {
  const sp = parseStructured(ref)
  const seg = sp?.segments[0]
  if (!sp || !seg) return ref
  return formatStructured({
    book: sp.book,
    segments: [{ chapter: seg.chapter, from: seg.from ?? 1, endChapter: null, to: null }],
  })
}
const toBibleRef = (ref: string): BibleRef => {
  const sp = parseStructured(ref)
  const seg = sp?.segments[0]
  return {
    book: sp?.book ?? 'gen',
    chapter: seg?.chapter ?? 1,
    from: seg?.from ?? null,
    to: seg?.to ?? null,
  }
}

const blankDay = (date: string): Day => ({
  id: '',
  date,
  headlineFr: '',
  headlineEn: '',
  readings: [],
  psalm: '',
  reflectionFr: '',
  reflectionEn: '',
  verseRef: '',
  verseFr: '',
  verseEn: '',
})

function DayForm({
  planId,
  day,
  canEdit,
  onDone,
}: {
  planId: string
  day: Day
  canEdit: boolean
  onDone: () => void
}) {
  const { t, locale } = useLocale()
  const lang = locale === 'en' ? 'en' : 'fr'
  const [v, setV] = useState(day)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof Day>(key: K, value: Day[K]) => setV((x) => ({ ...x, [key]: value }))
  const setReading = (i: number, next: Reading) =>
    set(
      'readings',
      v.readings.map((y, j) => (j === i ? next : y)),
    )
  const readingOk = (r: Reading) => {
    const sp = parseStructured(r.ref)
    return !!sp && !checkPassage(sp) && r.label !== ''
  }
  const psalmRef = v.psalm.trim() ? parsePsalm(v.psalm) : null
  const psalmOk = v.psalm.trim() === '' || (!!psalmRef && !checkPsalm(psalmRef))
  const valid =
    v.readings.every(readingOk) && psalmOk && (v.readings.length > 0 || v.psalm.trim() !== '')
  // The verse of the day is one of the day's own passages: the first one until the editor picks another.
  const passages = [
    ...v.readings.filter((r) => parseStructured(r.ref)).map((r) => r.ref),
    ...(psalmRef ? [`Psaumes ${v.psalm}`] : []),
  ]
  const choices =
    v.verseRef && !passages.includes(v.verseRef) ? [...passages, v.verseRef] : passages
  // The verse of the day starts as the first verse of the first passage; the editor can pick another passage or narrow it.
  const verseRef = v.verseRef || firstVerse(choices[0] ?? '')
  const [autoText, setAutoText] = useState(!day.verseEn)
  const [loadingText, setLoadingText] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch when the verse changes
  useEffect(() => {
    if (!canEdit || !autoText || !verseRef) return
    const timer = setTimeout(async () => {
      setLoadingText(true)
      try {
        const r = await api<{ text: string }>(
          `/meditations/bible-text?ref=${encodeURIComponent(verseRef)}`,
        )
        setV((x) => ({ ...x, verseEn: r.text }))
      } catch {
        // No text found (or the service is down): the editor types it.
      } finally {
        setLoadingText(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [verseRef, autoText])
  const save = useMutation({
    mutationFn: () =>
      api(`/meditations/plans/${planId}/days/${day.date}`, {
        method: 'PUT',
        body: {
          headlineFr: v.headlineFr,
          headlineEn: v.headlineEn,
          readings: v.readings,
          psalm: v.psalm,
          reflectionFr: v.reflectionFr,
          reflectionEn: v.reflectionEn,
          verseRef: parseStructured(verseRef) ? verseRef : '',
          verseFr: v.verseFr,
          verseEn: v.verseEn,
        },
      }),
    onSuccess: () => {
      say(t(k('day_saved')))
      onDone()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const del = useMutation({
    mutationFn: () => api(`/meditations/plans/${planId}/days/${day.date}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('day_deleted')))
      onDone()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  return (
    <div className="med-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t(k('headline_fr'))}
          placeholder={t(k('headline_ph'))}
          value={v.headlineFr}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('headlineFr', e.target.value)}
        />
        <TextField
          label={t(k('headline_en'))}
          placeholder=""
          value={v.headlineEn}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('headlineEn', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <h3 className="text-lg">{t(k('readings'))}</h3>
        <p className="text-sm text-ink-muted">{t(k('readings_help'))}</p>
        {v.readings.map((r, i) => (
          <ReadingEditor
            // biome-ignore lint/suspicious/noArrayIndexKey: edited in place
            key={i}
            idPrefix={`${day.date}-r${i}`}
            value={r}
            disabled={!canEdit}
            onChange={(next) => setReading(i, next)}
            onRemove={() =>
              set(
                'readings',
                v.readings.filter((_, j) => j !== i),
              )
            }
          />
        ))}
        {v.readings.length < 3 && canEdit && (
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => set('readings', [...v.readings, { label: '', ref: '' }])}
            >
              <Icon name="plus" size={16} />
              {t(k('add_reading'))}
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <h3 className="text-lg">{t(k('psalm'))}</h3>
        <p className="text-sm text-ink-muted">{t(k('psalm_help'))}</p>
        <PsalmEditor value={v.psalm} disabled={!canEdit} onChange={(x) => set('psalm', x)} />
      </div>
      <div className="grid gap-2">
        <h3 className="text-lg">{t(k('verse_h'))}</h3>
        <p className="text-sm text-ink-muted">{t(k('verse_help'))}</p>
        {choices.length === 0 ? (
          <p className="text-sm text-ink-muted">{t(k('verse_wait'))}</p>
        ) : (
          <div className="grid gap-3">
            <SelectField
              label={t(k('verse_pick'))}
              value={choices.find((p) => firstVerse(p) === verseRef) ?? ''}
              placeholder={formatPassage(verseRef, lang)}
              onValueChange={(x) => x && set('verseRef', firstVerse(x))}
              options={choices.map((p) => ({ value: p, label: formatPassage(p, lang) }))}
            />
            {parseStructured(verseRef)?.segments[0] && (
              <RefEditor
                idPrefix={`${day.date}-verse`}
                disabled={!canEdit}
                value={toBibleRef(verseRef)}
                onChange={(r) => {
                  setAutoText(true)
                  set(
                    'verseRef',
                    formatStructured({
                      book: r.book,
                      segments: [
                        {
                          chapter: r.chapter,
                          from: r.from ?? null,
                          endChapter: null,
                          to: r.to ?? null,
                        },
                      ],
                    }),
                  )
                }}
              />
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t(k('verse_fr'))}
            placeholder=""
            textarea
            value={v.verseFr}
            hint={t(k('verse_fr_help'))}
            disabled={!canEdit}
            onChange={(e: { target: { value: string } }) => set('verseFr', e.target.value)}
          />
          <TextField
            label={t(k('verse_en'))}
            placeholder=""
            textarea
            value={v.verseEn}
            hint={loadingText ? t(k('verse_loading')) : t(k('verse_en_help'))}
            disabled={!canEdit}
            onChange={(e: { target: { value: string } }) => {
              setAutoText(false)
              set('verseEn', e.target.value)
            }}
          />
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
            {t(k('save'))}
          </Button>
          {day.id && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={20} />
              {t(k('delete_day'))}
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t(k('delete_day_t'))}
        text={t(k('delete_day_p'))}
        confirmLabel={t(k('delete_day'))}
        danger
        busy={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  )
}

/* ── CSV import ───────────────────────────────────────────────────────── */
/** The model file: the header the importer reads, an ordinary day, a Sunday with three readings, a holiday headline. */
const TEMPLATE_CSV = [
  'Date,Day,Headline,Reading 1 Label,Reading 1 Ref,Reading 2 Label,Reading 2 Ref,Reading 3 Label,Reading 3 Ref,Psalm',
  '2026-07-01,Mercredi,,,"Amos 4, 1-13",,,,,"89, 31-47"',
  '2026-07-02,Jeudi,,,"Amos 5, 1-17",,,,,64',
  '2026-07-05,Dimanche,,Ancien Testament,"Esaïe 63, 16-19; 64, 2-7",Épître,"1 Thessaloniciens 1, 5-10",Évangile,"Matthieu 22, 34-40",18',
  '2026-12-25,Vendredi,Noël,Ancien Testament,"Esaïe 9, 1-6",Épître,"Tite 2, 11-14",Évangile,"Luc 2, 1-14",96',
].join('\r\n')

function downloadTemplate() {
  // A BOM so a spreadsheet opens the accents correctly.
  const blob = new Blob([`\uFEFF${TEMPLATE_CSV}\r\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'meditations-modele.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function ImportPanel({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const { t, locale } = useLocale()
  const lang = locale === 'en' ? 'en' : 'fr'
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const errors = result?.issues.filter((i) => i.level === 'error') ?? []
  const warnings = result?.issues.filter((i) => i.level === 'warning') ?? []
  const ok = result?.rows.filter((r) => r.valid) ?? []
  const skipped = (result?.rows.length ?? 0) - ok.length
  const outside = ok.filter((r) => r.date < plan.startsOn || r.date > plan.endsOn)
  const run = useMutation({
    mutationFn: () =>
      api<{ created: number; updated: number }>(`/meditations/plans/${plan.id}/import`, {
        method: 'POST',
        body: { rows: ok.map(({ line: _l, valid: _v, ...r }) => r) },
      }),
    onSuccess: (r) => {
      say(t(k('import_done'), { created: String(r.created), updated: String(r.updated) }))
      setText('')
      setResult(null)
      onDone()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const check = (csv: string) => setResult(csv.trim() ? readMeditationCsv(csv) : null)
  const issueText = (i: ImportResult['issues'][number]) =>
    t(k(`issue_${i.code}`), { d: i.detail ?? '' })
  const lines = new Set(result?.rows.map((r) => r.line))
  const general = result?.issues.filter((i) => !lines.has(i.line)) ?? []
  const weekday = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${d}T12:00:00Z`))
  return (
    <div className="grid gap-4">
      <h2 className="text-xl">{t(k('import_h'))}</h2>
      <p className="max-w-[70ch] text-ink-muted">{t(k('import_help'))}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={downloadTemplate}>
          <Icon name="download" size={20} />
          {t(k('import_template'))}
        </Button>
        <label className="btn btn-secondary">
          <Icon name="upload" size={20} />
          {t(k('import_file'))}
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const content = await f.text()
              setText(content)
              check(content)
              e.target.value = ''
            }}
          />
        </label>
        <span className="text-sm text-ink-muted">{t(k('import_or_paste'))}</span>
      </div>
      <TextField
        label="CSV"
        placeholder={t(k('import_paste_ph'))}
        textarea
        value={text}
        onChange={(e: { target: { value: string } }) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!text.trim()} onClick={() => check(text)}>
          {t(k('import_check'))}
        </Button>
        {result && (
          <Button
            variant="ghost"
            onClick={() => {
              setText('')
              setResult(null)
            }}
          >
            {t(k('import_clear'))}
          </Button>
        )}
      </div>
      {result && (
        <div className="admin-panel grid gap-3" role="status">
          <p className="font-medium">
            {t(k('import_summary'), {
              n: String(result.rows.length),
              e: String(errors.length),
              w: String(warnings.length),
            })}
          </p>
          {result.ignored.length > 0 && (
            <p className="text-sm text-ink-muted">
              {t(k('import_ignored'), { cols: result.ignored.join(', ') })}
            </p>
          )}
          {outside.length > 0 && (
            <p className="text-sm text-ink-muted">
              {t(k('import_outside'), {
                n: String(outside.length),
                a: plan.startsOn,
                b: plan.endsOn,
              })}
            </p>
          )}
          {general.length > 0 && (
            <ul className="grid gap-1">
              {general.map((i, n) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a static report
                <li
                  key={n}
                  className="prio prio-high"
                  style={{ textTransform: 'none', justifySelf: 'start' }}
                >
                  <Icon name="alert" size={16} />
                  {t(k('line'), { n: String(i.line) })} · {issueText(i)}
                </li>
              ))}
            </ul>
          )}
          {result.rows.length > 0 && (
            <div className="chart-table-wrap med-preview">
              <table className="chart-table">
                <thead>
                  <tr>
                    <th scope="col">{t(k('col_status'))}</th>
                    <th scope="col">{t(k('col_date'))}</th>
                    <th scope="col">{t(k('col_headline'))}</th>
                    <th scope="col">{t(k('col_readings'))}</th>
                    <th scope="col">{t(k('col_psalm'))}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => {
                    const mine = result.issues.filter((i) => i.line === r.line)
                    const level = !r.valid ? 'error' : mine.length ? 'warning' : 'ok'
                    return (
                      <tr key={`${r.date}-${r.line}`} data-level={level}>
                        <td>
                          <Icon
                            name={level === 'ok' ? 'check' : level === 'warning' ? 'info' : 'alert'}
                            size={16}
                          />
                          <span className="sr-only">{t(k(`row_${level}`))}</span>
                        </td>
                        <th scope="row">{weekday(r.date)}</th>
                        <td>{r.headline}</td>
                        <td>
                          {r.readings.map((x) => formatPassage(x.ref, lang)).join(' · ')}
                          {mine.map((i, n) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: a static report
                            <span key={n} className="med-preview-issue">
                              {issueText(i)}
                            </span>
                          ))}
                        </td>
                        <td>{r.psalm ? formatPsalm(r.psalm, lang) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {ok.length > 0 && (
            <div className="grid gap-2">
              {skipped > 0 && (
                <p className="text-sm text-danger">
                  {t(k('import_skipped'), { n: String(skipped) })}
                </p>
              )}
              <div>
                <Button loading={run.isPending} onClick={() => run.mutate()}>
                  {t(k('import_go'), { n: String(ok.length) })}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
