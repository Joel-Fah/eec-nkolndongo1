/**
 * Meditations (admin, /m/meditations): the programmes, the days of a programme (a month at a time, a row each, opened in
 * place to edit), and the import of the parish's yearly calendar from a CSV, checked line by line before anything is saved.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog } from '@eec/content-kit'
import {
  formatPassage,
  formatPsalm,
  type ImportResult,
  PASSAGE_TAIL,
  parsePassage,
  READING_LABELS,
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
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T12:00:00Z`))
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
                  {fmt(p.startsOn)} → {fmt(p.endsOn)} · {t(k('days_count'), { n: String(p.days) })}
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
      <Button variant="ghost" onClick={onBack}>
        <Icon name="chevronLeft" size={20} />
        {t(k('back'))}
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <Badge tone={plan.state === 'published' ? 'success' : 'warning'}>
            {t(k(`status_${plan.state}`))}
          </Badge>
          <h1 className="text-4xl">{(locale === 'en' && plan.titleEn) || plan.titleFr}</h1>
          <p className="text-ink-muted">
            {plan.startsOn} → {plan.endsOn} · {t(k('days_count'), { n: String(plan.days) })}
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
    new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${d}T12:00:00Z`),
    )
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
              setOpenDate(e.target.value || null)
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
                onClick={() => setOpenDate(openDate === d.date ? null : d.date)}
              >
                <span className="med-date">{weekday(d.date)}</span>
                <span className="med-headline">{d.headlineFr}</span>
                <span className="med-readings">
                  {d.readings.map((r) => formatPassage(r.ref, locale)).join(' · ')}
                </span>
                <span className="med-psalm">{d.psalm ? formatPsalm(d.psalm, locale) : ''}</span>
                <Icon name="chevronDown" size={16} />
              </button>
              {openDate === d.date && (
                <DayForm
                  key={d.date}
                  planId={plan.id}
                  day={d}
                  canEdit={canEdit}
                  onDone={() => {
                    setOpenDate(null)
                    setAdding('')
                    qc.invalidateQueries({ queryKey: ['meditation-days', plan.id] })
                    qc.invalidateQueries({ queryKey: ['meditation-plans'] })
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
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
  const [v, setV] = useState(day)
  const set = <K extends keyof Day>(key: K, value: Day[K]) => setV((x) => ({ ...x, [key]: value }))
  const refOk = (r: string) => {
    const tail = parsePassage(r).tail
    return r.trim().length >= 2 && (tail === '' || PASSAGE_TAIL.test(tail))
  }
  const valid =
    v.readings.every((r) => refOk(r.ref)) &&
    (v.psalm === '' || PASSAGE_TAIL.test(v.psalm)) &&
    (v.readings.length > 0 || v.psalm.trim() !== '')
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
          verseRef: v.verseRef,
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
  const passages = [
    ...v.readings.map((r) => r.ref),
    ...(v.psalm ? [`Psaumes ${v.psalm}`] : []),
  ].filter(Boolean)
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
          // biome-ignore lint/suspicious/noArrayIndexKey: edited in place
          <div key={i} className="reading-box">
            <div className="link-row" data-other="">
              <SelectField
                label={t(k('reading_label'))}
                value={r.label || 'none'}
                onValueChange={(x) =>
                  x &&
                  set(
                    'readings',
                    v.readings.map((y, j) =>
                      j === i ? { ...y, label: x === 'none' ? '' : (x as Reading['label']) } : y,
                    ),
                  )
                }
                options={[
                  { value: 'none', label: t(k('label_none')) },
                  ...READING_LABELS.map((l) => ({ value: l, label: t(k(`label_${l}`)) })),
                ]}
              />
              <TextField
                label={t(k('reading_ref'))}
                placeholder="Amos 4, 1-13"
                hint={
                  r.ref && !refOk(r.ref)
                    ? t(k('issue_bad_ref'), { d: r.ref })
                    : r.ref
                      ? formatPassage(r.ref, locale === 'en' ? 'en' : 'fr')
                      : undefined
                }
                value={r.ref}
                disabled={!canEdit}
                onChange={(e: { target: { value: string } }) =>
                  set(
                    'readings',
                    v.readings.map((y, j) => (j === i ? { ...y, ref: e.target.value } : y)),
                  )
                }
              />
              <Button
                variant="secondary"
                className="reading-remove"
                aria-label={t(k('remove'))}
                onClick={() =>
                  set(
                    'readings',
                    v.readings.filter((_, j) => j !== i),
                  )
                }
              >
                <Icon name="close" size={20} />
              </Button>
            </div>
          </div>
        ))}
        {v.readings.length < 3 && canEdit && (
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => set('readings', [...v.readings, { label: '', ref: '' }])}
            >
              {t(k('add_reading'))}
            </Button>
          </div>
        )}
        <TextField
          label={t(k('psalm'))}
          placeholder={t(k('psalm_ph'))}
          hint={t(k('psalm_help'))}
          value={v.psalm}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('psalm', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <h3 className="text-lg">{t(k('verse_h'))}</h3>
        <p className="text-sm text-ink-muted">{t(k('verse_help'))}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label={t(k('verse_pick'))}
            value="pick"
            onValueChange={(x) => x && x !== 'pick' && set('verseRef', x === 'none' ? '' : x)}
            placeholder={t(k('verse_pick'))}
            options={[
              { value: 'pick', label: t(k('verse_pick')) },
              { value: 'none', label: t(k('verse_none')) },
              ...passages.map((p) => ({ value: p.replace(/^Psaumes /, 'Psaumes '), label: p })),
            ]}
          />
          <TextField
            label={t(k('verse_ref'))}
            placeholder="Amos 4, 12"
            value={v.verseRef}
            disabled={!canEdit}
            onChange={(e: { target: { value: string } }) => set('verseRef', e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t(k('verse_fr'))}
            placeholder=""
            textarea
            value={v.verseFr}
            disabled={!canEdit}
            onChange={(e: { target: { value: string } }) => set('verseFr', e.target.value)}
          />
          <TextField
            label={t(k('verse_en'))}
            placeholder=""
            textarea
            value={v.verseEn}
            disabled={!canEdit}
            onChange={(e: { target: { value: string } }) => set('verseEn', e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t(k('reflection_fr'))}
          hint={t(k('reflection_help'))}
          placeholder=""
          textarea
          value={v.reflectionFr}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('reflectionFr', e.target.value)}
        />
        <TextField
          label={t(k('reflection_en'))}
          placeholder=""
          textarea
          value={v.reflectionEn}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('reflectionEn', e.target.value)}
        />
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
            {t(k('save'))}
          </Button>
          {day.id && (
            <Button variant="ghost" loading={del.isPending} onClick={() => del.mutate()}>
              {t(k('delete_day'))}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── CSV import ───────────────────────────────────────────────────────── */
function ImportPanel({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const { t } = useLocale()
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const errors = result?.issues.filter((i) => i.level === 'error') ?? []
  const warnings = result?.issues.filter((i) => i.level === 'warning') ?? []
  const outside = result?.rows.filter((r) => r.date < plan.startsOn || r.date > plan.endsOn) ?? []
  const run = useMutation({
    mutationFn: () =>
      api<{ created: number; updated: number }>(`/meditations/plans/${plan.id}/import`, {
        method: 'POST',
        body: { rows: (result?.rows ?? []).map(({ line: _l, ...r }) => r) },
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
  return (
    <div className="grid gap-4">
      <h2 className="text-xl">{t(k('import_h'))}</h2>
      <p className="max-w-[70ch] text-ink-muted">{t(k('import_help'))}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-secondary">
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
              {outside.length} × {plan.startsOn} → {plan.endsOn}
            </p>
          )}
          {result.issues.length > 0 && (
            <ul className="grid gap-1">
              {result.issues.map((i, n) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a static report
                <li
                  key={n}
                  className={`prio ${i.level === 'error' ? 'prio-high' : 'prio-medium'}`}
                  style={{ textTransform: 'none', justifySelf: 'start' }}
                >
                  <Icon name={i.level === 'error' ? 'alert' : 'info'} size={16} />
                  {t(k('line'), { n: String(i.line) })} · {issueText(i)}
                </li>
              ))}
            </ul>
          )}
          {result.rows.length > 0 && (
            <div className="chart-table-wrap">
              <table className="chart-table">
                <thead>
                  <tr>
                    <th scope="col">{t(k('col_date'))}</th>
                    <th scope="col">{t(k('col_headline'))}</th>
                    <th scope="col">{t(k('col_readings'))}</th>
                    <th scope="col">{t(k('col_psalm'))}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 8).map((r) => (
                    <tr key={r.date}>
                      <th scope="row">{r.date}</th>
                      <td>{r.headline}</td>
                      <td>{r.readings.map((x) => x.ref).join(' · ')}</td>
                      <td>{r.psalm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errors.length > 0 ? (
            <p className="text-sm text-danger">{t(k('import_blocked'))}</p>
          ) : (
            result.rows.length > 0 && (
              <div>
                <Button loading={run.isPending} onClick={() => run.mutate()}>
                  {t(k('import_go'), { n: String(result.rows.length) })}
                </Button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
