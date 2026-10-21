/**
 * Liturgie (admin, /m/liturgy): the Sundays (next 8, the 4 before), the liturgical year's texts (approved before
 * they show) and the verses. People's names on a Sunday are public only when the consent box is ticked.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { GuardedDialog, ViewToggle } from '@eec/content-kit'
import { type BibleRef, BOOKS, formatRef, SEASONS, shortDate, weekLabel } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  Icon,
  SelectField,
  SwitchField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

const k = (key: string) => `liturgy.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })

type Entry = {
  id: string
  date: string
  nameFr: string
  nameEn: string
  themeFr: string
  themeEn: string
  readings: BibleRef[]
  preacherName: string
  liturgistName: string
  namesConsent: boolean
  hymns: string
  notesFr: string
  notesEn: string
  state: 'draft' | 'published'
}
type Row = { date: string; suggested: { fr: string; en: string }; entry: Entry | null }
type Form = Omit<Entry, 'id' | 'state'> & { state: 'draft' | 'published' }
const blankForm = (date: string): Form => ({
  date,
  nameFr: '',
  nameEn: '',
  themeFr: '',
  themeEn: '',
  readings: [],
  preacherName: '',
  liturgistName: '',
  namesConsent: false,
  hymns: '',
  notesFr: '',
  notesEn: '',
  state: 'draft',
})

export default function LiturgyPage() {
  const { t } = useLocale()
  return (
    <div className="grid gap-6">
      <header className="grid max-w-[62ch] gap-2">
        <h1 className="text-4xl">{t(k('title'))}</h1>
        <p className="text-ink-muted">{t(k('lead'))}</p>
      </header>
      <div className="admin-panel">
        <TabsBox
          tabs={[
            {
              id: 'sundays',
              label: (
                <span className="tab-label">
                  <Icon name="calendarDay" size={20} />
                  {t(k('tab_sundays'))}
                </span>
              ),
              content: <Sundays />,
            },
            {
              id: 'year',
              label: (
                <span className="tab-label">
                  <Icon name="calendarYear" size={20} />
                  {t(k('tab_year'))}
                </span>
              ),
              content: <Year />,
            },
            {
              id: 'verses',
              label: (
                <span className="tab-label">
                  <Icon name="bookText" size={20} />
                  {t(k('tab_verses'))}
                </span>
              ),
              content: <Verses />,
            },
          ]}
        />
      </div>
    </div>
  )
}

/* ── Sundays ──────────────────────────────────────────────────────────── */
function Sundays() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'liturgy:edit')
  const canPublish = hasPermission(me, 'liturgy:publish')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [weeks, setWeeks] = useState(8)
  const [form, setForm] = useState<Form | null>(null)
  const [initial, setInitial] = useState('')
  const [suggested, setSuggested] = useState({ fr: '', en: '' })
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState('')
  const list = useQuery({
    queryKey: ['liturgy', 'sundays', weeks],
    queryFn: () => api<{ current: string; items: Row[] }>(`/liturgy/sundays?weeks=${weeks}`),
  })
  const people = useQuery({
    queryKey: ['liturgy', 'people'],
    queryFn: () => api<{ names: string[] }>('/liturgy/people'),
    retry: false,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['liturgy'] })
  const body = (f: Form) => ({
    nameFr: f.nameFr,
    nameEn: f.nameEn,
    themeFr: f.themeFr,
    themeEn: f.themeEn,
    readings: f.readings,
    preacherName: f.preacherName,
    liturgistName: f.liturgistName,
    namesConsent: f.namesConsent,
    hymns: f.hymns,
    notesFr: f.notesFr,
    notesEn: f.notesEn,
  })
  const save = useMutation({
    mutationFn: (f: Form) => api(`/liturgy/sundays/${f.date}`, { method: 'PUT', body: body(f) }),
    onSuccess: () => {
      say(t(k('saved')))
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const publish = useMutation({
    mutationFn: (a: { date: string; published: boolean }) =>
      api(`/liturgy/sundays/${a.date}/publish`, {
        method: 'POST',
        body: { published: a.published },
      }),
    onSuccess: (_r, a) => {
      say(t(k(a.published ? 'published_toast' : 'unpublished_toast')))
      setForm(null)
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const dup = useMutation({
    mutationFn: (date: string) =>
      api(`/liturgy/sundays/${date}/duplicate-previous`, { method: 'POST', body: {} }),
    onSuccess: () => {
      say(t(k('duplicated')))
      setForm(null)
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const label = (r: Row) =>
    (locale === 'en' ? r.entry?.nameEn || r.entry?.nameFr : r.entry?.nameFr) ||
    (locale === 'en' ? r.suggested.en : r.suggested.fr)
  const openRow = (r: Row) => {
    const f = r.entry ? { ...r.entry } : blankForm(r.date)
    setSuggested(r.suggested)
    setInitial(JSON.stringify(f))
    setForm(f)
  }
  const status = (r: Row) =>
    !r.entry ? (
      <Badge tone="warning">{t(k('to_prepare'))}</Badge>
    ) : r.entry.state === 'published' ? (
      <Badge tone="success">{t(k('published'))}</Badge>
    ) : (
      <Badge tone="info">{t(k('draft'))}</Badge>
    )
  const items = list.data?.items ?? []
  const current = list.data?.current
  const setReading = (i: number, p: Partial<BibleRef>) =>
    form &&
    setForm({ ...form, readings: form.readings.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const pickSunday = () => {
    if (!pick) return
    if (new Date(`${pick}T00:00:00Z`).getUTCDay() !== 0) return say(t(k('not_sunday')), 'danger')
    const row = items.find((r) => r.date === pick)
    setAdding(false)
    setPick('')
    openRow(row ?? { date: pick, suggested: { fr: '', en: '' }, entry: null })
  }

  const text = (lang: 'Fr' | 'En', f: Form) => (
    <div className="grid gap-4">
      <TextField
        label={t(k(lang === 'Fr' ? 'name_fr' : 'name_en'))}
        placeholder={lang === 'Fr' ? suggested.fr : suggested.en}
        icon="church"
        hint={t(k('name_suffix'), { name: lang === 'Fr' ? suggested.fr : suggested.en })}
        value={lang === 'Fr' ? f.nameFr : f.nameEn}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) =>
          setForm({ ...f, [`name${lang}`]: e.target.value })
        }
      />
      <TextField
        label={t(k(lang === 'Fr' ? 'theme_fr' : 'theme_en'))}
        placeholder=""
        icon="sparkles"
        value={lang === 'Fr' ? f.themeFr : f.themeEn}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) =>
          setForm({ ...f, [`theme${lang}`]: e.target.value })
        }
      />
      <TextField
        label={t(k(lang === 'Fr' ? 'notes_fr' : 'notes_en'))}
        placeholder=""
        icon="info"
        textarea
        value={lang === 'Fr' ? f.notesFr : f.notesEn}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) =>
          setForm({ ...f, [`notes${lang}`]: e.target.value })
        }
      />
    </div>
  )

  const groups = items.map((r) => ({ week: weekLabel(r.date, locale), r }))
  const card = (r: Row) => (
    <button
      type="button"
      className={view === 'grid' ? 'sunday-card-admin' : 'admin-row news-row'}
      onClick={() => openRow(r)}
      data-current={r.date === current ? '' : undefined}
    >
      <span className="flex items-center gap-3 text-start">
        <span className="kind-tile" data-tone={r.entry ? 'primary' : 'clay'} aria-hidden="true">
          <Icon name="calendarDay" size={20} />
        </span>
        <span className="grid">
          {view === 'grid' && <span className="week-caption">{weekLabel(r.date, locale)}</span>}
          <strong>
            {shortDate(`${r.date}T12:00:00Z`, locale, 'UTC')}
            {r.date === current ? ` · ${t(k('today_marker'))}` : ''}
          </strong>
          <span className="text-sm text-ink-muted">
            {label(r)}
            {r.entry?.themeFr ? ` · ${r.entry.themeFr}` : ''}
          </span>
        </span>
      </span>
      {status(r)}
    </button>
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ViewToggle
          value={view}
          onChange={setView}
          label={t(k('tab_sundays'))}
          options={[
            { id: 'grid', label: t(k('view_grid')), icon: 'gridView' },
            { id: 'list', label: t(k('view_list')), icon: 'layoutList' },
          ]}
        />
        {canEdit && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={20} />
            {t(k('add_sunday'))}
          </Button>
        )}
      </div>
      {view === 'grid' ? (
        <div className="sunday-grid">
          {groups.map(({ r }) => (
            <div key={r.date}>{card(r)}</div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map(({ week, r }) => (
            <section key={r.date} className="grid gap-2" aria-label={week}>
              <h3 className="week-head">{week}</h3>
              {card(r)}
            </section>
          ))}
        </div>
      )}
      <div>
        <Button variant="ghost" onClick={() => setWeeks((w) => w + 8)}>
          {t(k('load_more'))}
        </Button>
      </div>

      <GuardedDialog
        open={adding}
        onClose={() => {
          setAdding(false)
          setPick('')
        }}
        dirty={false}
      >
        {(requestClose) => (
          <form
            className="dialog-body"
            onSubmit={(e) => {
              e.preventDefault()
              pickSunday()
            }}
          >
            <h2 className="dialog-title">{t(k('add_sunday'))}</h2>
            <label className="grid gap-1">
              <span className="field-label">{t(k('pick_date'))}</span>
              <input
                className="input"
                type="date"
                required
                value={pick}
                onChange={(e) => setPick(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <Button type="button" variant="secondary" onClick={requestClose}>
                {t(k('cancel'))}
              </Button>
              <Button type="submit">{t(k('edit'))}</Button>
            </div>
          </form>
        )}
      </GuardedDialog>

      <GuardedDialog
        open={!!form}
        onClose={() => setForm(null)}
        dirty={!!form && JSON.stringify(form) !== initial}
        wide
      >
        {(requestClose) =>
          form && (
            <form
              className="dialog-body"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(form)
              }}
            >
              <header className="grid gap-1">
                <h2 className="dialog-title">
                  {shortDate(`${form.date}T12:00:00Z`, locale, 'UTC')}
                </h2>
                <p className="text-sm text-ink-muted">
                  {weekLabel(form.date, locale)} ·{' '}
                  {t(k(form.state === 'published' ? 'status_published' : 'status_draft'))}
                </p>
              </header>

              <section className="form-group">
                <h3 className="form-legend">
                  <Icon name="info" size={20} />
                  {t(k('section_details'))}
                </h3>
                <TabsBox
                  tabs={[
                    { id: 'fr', label: t(k('lang_fr')), content: text('Fr', form) },
                    { id: 'en', label: t(k('lang_en')), content: text('En', form) },
                  ]}
                />
              </section>

              <section className="form-group">
                <h3 className="form-legend">
                  <Icon name="bookText" size={20} />
                  {t(k('section_readings'))}
                </h3>
                {form.readings.map((r, i) => (
                  <div key={`${r.book}-${i}`} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-40 flex-1">
                      <SelectField
                        label={t(k('book'))}
                        value={r.book}
                        onValueChange={(v) => v && setReading(i, { book: v as BibleRef['book'] })}
                        options={BOOKS.map((b) => ({
                          value: b.id,
                          label: locale === 'en' ? b.en : b.fr,
                        }))}
                      />
                    </div>
                    <label className="grid w-24 gap-1">
                      <span className="field-label">{t(k('chapter'))}</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={150}
                        value={r.chapter}
                        onChange={(e) => setReading(i, { chapter: Number(e.target.value) || 1 })}
                      />
                    </label>
                    <label className="grid w-24 gap-1">
                      <span className="field-label">{t(k('from'))}</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={r.from ?? ''}
                        onChange={(e) =>
                          setReading(i, { from: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                    </label>
                    <label className="grid w-24 gap-1">
                      <span className="field-label">{t(k('to'))}</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={r.to ?? ''}
                        onChange={(e) =>
                          setReading(i, { to: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        setForm({ ...form, readings: form.readings.filter((_, j) => j !== i) })
                      }
                    >
                      {t(k('remove'))}
                    </Button>
                    <span className="w-full text-sm text-ink-muted">{formatRef(r, locale)}</span>
                  </div>
                ))}
                {canEdit && form.readings.length < 6 && (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setForm({
                          ...form,
                          readings: [
                            ...form.readings,
                            { book: 'mat', chapter: 1, from: null, to: null },
                          ],
                        })
                      }
                    >
                      <Icon name="plus" size={16} />
                      {t(k('add_reading'))}
                    </Button>
                  </div>
                )}
              </section>

              <section className="form-group">
                <h3 className="form-legend">
                  <Icon name="users" size={20} />
                  {t(k('section_people'))}
                </h3>
                <datalist id="liturgy-pastors">
                  {(people.data?.names ?? []).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <label className="grid gap-1">
                  <span className="field-label">{t(k('preacher'))}</span>
                  <input
                    className="input"
                    list="liturgy-pastors"
                    placeholder=""
                    value={form.preacherName}
                    disabled={!canEdit}
                    onChange={(e) => setForm({ ...form, preacherName: e.target.value })}
                  />
                  <span className="field-hint">{t(k('preacher_help'))}</span>
                </label>
                <TextField
                  label={t(k('liturgist'))}
                  placeholder=""
                  icon="account"
                  value={form.liturgistName}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, liturgistName: e.target.value })
                  }
                />
                <SwitchField
                  label={t(k('consent'))}
                  checked={form.namesConsent}
                  onCheckedChange={(v: boolean) => setForm({ ...form, namesConsent: v })}
                />
                <p className="text-xs text-ink-muted">{t(k('consent_help'))}</p>
              </section>

              <section className="form-group">
                <h3 className="form-legend">
                  <Icon name="music" size={20} />
                  {t(k('section_more'))}
                </h3>
                <TextField
                  label={t(k('hymns'))}
                  placeholder=""
                  icon="music"
                  value={form.hymns}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, hymns: e.target.value })
                  }
                />
              </section>

              <div className="form-actions">
                <div className="form-actions-side">
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      loading={dup.isPending}
                      onClick={() => dup.mutate(form.date)}
                    >
                      <Icon name="copy" size={20} />
                      {t(k('duplicate'))}
                    </Button>
                  )}
                </div>
                <div className="form-actions-main">
                  <Button type="button" variant="ghost" onClick={requestClose}>
                    {t(k('cancel'))}
                  </Button>
                  {canPublish && form.state === 'published' && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => publish.mutate({ date: form.date, published: false })}
                    >
                      {t(k('unpublish'))}
                    </Button>
                  )}
                  {canEdit && (
                    <Button type="submit" variant="secondary" loading={save.isPending}>
                      {t(k('save_draft'))}
                    </Button>
                  )}
                  {canPublish && form.state !== 'published' && (
                    <Button
                      type="button"
                      loading={publish.isPending}
                      onClick={async () => {
                        await save.mutateAsync(form).catch(() => null)
                        publish.mutate({ date: form.date, published: true })
                      }}
                    >
                      <Icon name="rocket" size={20} />
                      {t(k('publish_now'))}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          )
        }
      </GuardedDialog>
    </div>
  )
}

/* ── The year ─────────────────────────────────────────────────────────── */
type SeasonRow = {
  season: string
  row: {
    meaningFr: string
    meaningEn: string
    parishFr: string
    parishEn: string
    validated: boolean
  } | null
}
function Year() {
  const { t } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'liturgy:edit')
  const canValidate = hasPermission(me, 'liturgy:validate')
  const list = useQuery({
    queryKey: ['liturgy', 'seasons'],
    queryFn: () => api<{ items: SeasonRow[] }>('/liturgy/seasons'),
  })
  const [edit, setEdit] = useState<Record<string, Partial<NonNullable<SeasonRow['row']>>>>({})
  const refresh = () => qc.invalidateQueries({ queryKey: ['liturgy'] })
  const save = useMutation({
    mutationFn: (s: string) => api(`/liturgy/seasons/${s}`, { method: 'PUT', body: edit[s] ?? {} }),
    onSuccess: (_r, s) => {
      say(t(k('season_saved')))
      setEdit(({ [s]: _x, ...rest }) => rest)
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const validate = useMutation({
    mutationFn: (a: { s: string; validated: boolean }) =>
      api(`/liturgy/seasons/${a.s}/validate`, { method: 'POST', body: { validated: a.validated } }),
    onSuccess: refresh,
    onError: () => say(t(k('error')), 'danger'),
  })
  const field = (
    s: string,
    key: 'meaningFr' | 'meaningEn' | 'parishFr' | 'parishEn',
    row: SeasonRow['row'],
    label: string,
  ) => (
    <TextField
      label={label}
      placeholder=""
      textarea
      value={(edit[s]?.[key] ?? row?.[key] ?? '') as string}
      disabled={!canEdit}
      onChange={(e: { target: { value: string } }) =>
        setEdit({ ...edit, [s]: { ...edit[s], [key]: e.target.value } })
      }
    />
  )
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-muted">{t(k('year_help'))}</p>
      {(list.data?.items ?? []).map(({ season, row }) => (
        <section key={season} className="admin-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg">{t(`season.${season}` as MessageKey)}</h3>
            <span className="flex items-center gap-2">
              {row?.validated ? (
                <Badge tone="success">{t(k('approved'))}</Badge>
              ) : (
                <Badge tone="warning">{t(k('pending'))}</Badge>
              )}
              {canValidate && row && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => validate.mutate({ s: season, validated: !row.validated })}
                >
                  {t(k(row.validated ? 'unapprove' : 'approve'))}
                </Button>
              )}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field(season, 'meaningFr', row, t(k('meaning_fr')))}
            {field(season, 'meaningEn', row, t(k('meaning_en')))}
            {field(season, 'parishFr', row, t(k('parish_fr')))}
            {field(season, 'parishEn', row, t(k('parish_en')))}
          </div>
          {canEdit && edit[season] && (
            <div>
              <Button size="sm" loading={save.isPending} onClick={() => save.mutate(season)}>
                {t(k('save'))}
              </Button>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

/* ── Verses ───────────────────────────────────────────────────────────── */
type Verse = {
  id: string
  ref: BibleRef
  textFr: string
  textEn: string
  translationFr: string
  translationEn: string
  onDate: string | null
  season: string | null
  active: boolean
}
function Verses() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'liturgy:edit')
  const list = useQuery({
    queryKey: ['liturgy', 'verses'],
    queryFn: () => api<{ items: Verse[] }>('/liturgy/verses'),
  })
  const [form, setForm] = useState<(Partial<Verse> & { ref: BibleRef }) | null>(null)
  const [initial, setInitial] = useState('')
  const openForm = (f: Partial<Verse> & { ref: BibleRef }) => {
    setInitial(JSON.stringify(f))
    setForm(f)
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['liturgy'] })
  const save = useMutation({
    mutationFn: (v: Partial<Verse> & { ref: BibleRef }) => {
      const body = {
        ref: v.ref,
        textFr: v.textFr ?? '',
        textEn: v.textEn ?? '',
        onDate: v.onDate || null,
        season: v.season || null,
        active: v.active ?? true,
      }
      return v.id
        ? api(`/liturgy/verses/${v.id}`, { method: 'PATCH', body })
        : api('/liturgy/verses', { method: 'POST', body })
    },
    onSuccess: () => {
      setForm(null)
      say(t(k('verse_saved')))
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/liturgy/verses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('verse_deleted')))
      refresh()
    },
  })
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-muted">{t(k('verses_help'))}</p>
      {canEdit && (
        <div>
          <Button
            onClick={() =>
              openForm({ ref: { book: 'jhn', chapter: 3, from: 16, to: null }, active: true })
            }
          >
            {t(k('add_verse'))}
          </Button>
        </div>
      )}
      {list.data?.items.length === 0 && <p className="text-ink-muted">{t(k('no_verses'))}</p>}
      <ul className="grid gap-2">
        {(list.data?.items ?? []).map((v) => (
          <li key={v.id} className="admin-row">
            <span className="grid">
              <strong>{formatRef(v.ref, locale)}</strong>
              <span className="text-sm text-ink-muted">
                {(locale === 'en' ? v.textEn : v.textFr) || t(k('no_text'))}
                {v.onDate ? ` · ${v.onDate}` : ''}
                {v.season ? ` · ${t(`season.${v.season}` as MessageKey)}` : ''}
              </span>
            </span>
            {canEdit && (
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openForm({ ...v })}>
                  {t(k('edit'))}
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove.mutate(v.id)}>
                  {t(k('delete'))}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <GuardedDialog
        open={!!form}
        onClose={() => setForm(null)}
        dirty={!!form && JSON.stringify(form) !== initial}
      >
        {(requestClose) =>
          form && (
            <form
              className="dialog-body"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(form)
              }}
            >
              <h2 className="dialog-title">{t(k('add_verse'))}</h2>
              <SelectField
                label={t(k('book'))}
                value={form.ref.book}
                onValueChange={(v) =>
                  v && setForm({ ...form, ref: { ...form.ref, book: v as BibleRef['book'] } })
                }
                options={BOOKS.map((b) => ({
                  value: b.id,
                  label: locale === 'en' ? b.en : b.fr,
                }))}
              />
              <div className="grid grid-cols-3 gap-3">
                <label className="grid gap-1">
                  <span className="field-label">{t(k('chapter'))}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={150}
                    value={form.ref.chapter}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ref: { ...form.ref, chapter: Number(e.target.value) || 1 },
                      })
                    }
                  />
                </label>
                <label className="grid gap-1">
                  <span className="field-label">{t(k('from'))}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.ref.from ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ref: {
                          ...form.ref,
                          from: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                  />
                </label>
                <label className="grid gap-1">
                  <span className="field-label">{t(k('to'))}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.ref.to ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ref: { ...form.ref, to: e.target.value ? Number(e.target.value) : null },
                      })
                    }
                  />
                </label>
              </div>
              <TextField
                label={t(k('text_fr'))}
                placeholder=""
                textarea
                value={form.textFr ?? ''}
                onChange={(e: { target: { value: string } }) =>
                  setForm({ ...form, textFr: e.target.value })
                }
              />
              <TextField
                label={t(k('text_en'))}
                placeholder=""
                textarea
                value={form.textEn ?? ''}
                onChange={(e: { target: { value: string } }) =>
                  setForm({ ...form, textEn: e.target.value })
                }
              />
              <label className="grid gap-1">
                <span className="field-label">{t(k('on_date'))}</span>
                <input
                  className="input"
                  type="date"
                  value={form.onDate ?? ''}
                  onChange={(e) => setForm({ ...form, onDate: e.target.value || null })}
                />
              </label>
              <SelectField
                label={t(k('for_season'))}
                value={form.season ?? 'none'}
                onValueChange={(v) => setForm({ ...form, season: !v || v === 'none' ? null : v })}
                options={[
                  { value: 'none', label: t(k('no_season')) },
                  ...SEASONS.map((s) => ({ value: s, label: t(`season.${s}` as MessageKey) })),
                ]}
              />
              <SwitchField
                label={t(k('active'))}
                checked={form.active ?? true}
                onCheckedChange={(v: boolean) => setForm({ ...form, active: v })}
              />
              <div className="dialog-actions">
                <Button type="button" variant="secondary" onClick={requestClose}>
                  {t(k('cancel'))}
                </Button>
                <Button type="submit" loading={save.isPending}>
                  {t(k('save'))}
                </Button>
              </div>
            </form>
          )
        }
      </GuardedDialog>
    </div>
  )
}
