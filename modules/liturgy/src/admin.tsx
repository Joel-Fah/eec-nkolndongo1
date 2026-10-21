/**
 * Liturgie (admin, /m/liturgy): the Sundays (next 8, the 4 before), the liturgical year's texts (approved before
 * they show) and the verses. People's names on a Sunday are public only when the consent box is ticked.
 */
import { Dialog } from '@base-ui/react/dialog'
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { type BibleRef, BOOKS, formatRef, SEASONS } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
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
            { id: 'sundays', label: t(k('tab_sundays')), content: <Sundays /> },
            { id: 'year', label: t(k('tab_year')), content: <Year /> },
            { id: 'verses', label: t(k('tab_verses')), content: <Verses /> },
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
  const [form, setForm] = useState<Form | null>(null)
  const [suggested, setSuggested] = useState('')
  const list = useQuery({
    queryKey: ['liturgy', 'sundays'],
    queryFn: () => api<{ current: string; items: Row[] }>('/liturgy/sundays'),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['liturgy'] })
  const save = useMutation({
    mutationFn: (f: Form) =>
      api(`/liturgy/sundays/${f.date}`, {
        method: 'PUT',
        body: {
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
        },
      }),
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
  const day = (d: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    )
  const open = (r: Row) => {
    setSuggested(locale === 'en' ? r.suggested.en : r.suggested.fr)
    setForm(r.entry ? { ...r.entry } : blankForm(r.date))
  }
  const setReading = (i: number, p: Partial<BibleRef>) =>
    form &&
    setForm({ ...form, readings: form.readings.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {(list.data?.items ?? []).map((r) => (
          <li key={r.date}>
            <button type="button" className="admin-row news-row" onClick={() => open(r)}>
              <span className="grid text-start">
                <strong>
                  {day(r.date)}
                  {r.date === list.data?.current ? ` · ${t(k('today_marker'))}` : ''}
                </strong>
                <span className="text-sm text-ink-muted">
                  {(locale === 'en' ? r.entry?.nameEn || r.entry?.nameFr : r.entry?.nameFr) ||
                    (locale === 'en' ? r.suggested.en : r.suggested.fr)}
                  {r.entry?.themeFr ? ` · ${r.entry.themeFr}` : ''}
                </span>
              </span>
              {!r.entry ? (
                <Badge tone="warning">{t(k('to_prepare'))}</Badge>
              ) : r.entry.state === 'published' ? (
                <Badge tone="success">{t(k('published'))}</Badge>
              ) : (
                <Badge tone="info">{t(k('draft'))}</Badge>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Dialog.Root open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="eec-backdrop eec-overlay" />
          <Dialog.Popup className="dialog eec-dialog picker-dialog">
            {form && (
              <form
                className="dialog-body"
                onSubmit={(e) => {
                  e.preventDefault()
                  save.mutate(form)
                }}
              >
                <Dialog.Title className="dialog-title">{day(form.date)}</Dialog.Title>
                <TextField
                  label={t(k('name_fr'))}
                  placeholder={suggested}
                  hint={t(k('name_help'), { name: suggested })}
                  value={form.nameFr}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, nameFr: e.target.value })
                  }
                />
                <TextField
                  label={t(k('name_en'))}
                  placeholder=""
                  value={form.nameEn}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, nameEn: e.target.value })
                  }
                />
                <TextField
                  label={t(k('theme_fr'))}
                  placeholder=""
                  value={form.themeFr}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, themeFr: e.target.value })
                  }
                />
                <TextField
                  label={t(k('theme_en'))}
                  placeholder=""
                  value={form.themeEn}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, themeEn: e.target.value })
                  }
                />
                <div className="grid gap-2">
                  <span className="field-label">{t(k('readings'))}</span>
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
                        variant="ghost"
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
                      {t(k('add_reading'))}
                    </Button>
                  )}
                </div>
                <TextField
                  label={t(k('preacher'))}
                  placeholder=""
                  value={form.preacherName}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, preacherName: e.target.value })
                  }
                />
                <TextField
                  label={t(k('liturgist'))}
                  placeholder=""
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
                <TextField
                  label={t(k('hymns'))}
                  placeholder=""
                  value={form.hymns}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, hymns: e.target.value })
                  }
                />
                <TextField
                  label={t(k('notes_fr'))}
                  placeholder=""
                  value={form.notesFr}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setForm({ ...form, notesFr: e.target.value })
                  }
                />
                <div className="dialog-actions">
                  <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                    {t(k('cancel'))}
                  </Button>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      loading={dup.isPending}
                      onClick={() => dup.mutate(form.date)}
                    >
                      {t(k('duplicate'))}
                    </Button>
                  )}
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
                    <Button type="submit" loading={save.isPending}>
                      {t(k('save'))}
                    </Button>
                  )}
                  {canPublish && form.state !== 'published' && (
                    <Button
                      type="button"
                      onClick={async () => {
                        await save.mutateAsync(form).catch(() => null)
                        publish.mutate({ date: form.date, published: true })
                      }}
                    >
                      {t(k('publish'))}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
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
              setForm({ ref: { book: 'jhn', chapter: 3, from: 16, to: null }, active: true })
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
                <Button size="sm" variant="secondary" onClick={() => setForm({ ...v })}>
                  {t(k('edit'))}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(v.id)}>
                  {t(k('delete'))}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <Dialog.Root open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="eec-backdrop eec-overlay" />
          <Dialog.Popup className="dialog eec-dialog">
            {form && (
              <form
                className="dialog-body"
                onSubmit={(e) => {
                  e.preventDefault()
                  save.mutate(form)
                }}
              >
                <Dialog.Title className="dialog-title">{t(k('add_verse'))}</Dialog.Title>
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
                  <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                    {t(k('cancel'))}
                  </Button>
                  <Button type="submit" loading={save.isPending}>
                    {t(k('save'))}
                  </Button>
                </div>
              </form>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
