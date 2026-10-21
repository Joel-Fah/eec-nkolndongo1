/**
 * Cultes et horaires (admin, /m/schedule): the weekly rhythm as a grid (default) or a list, approve/unapprove
 * (schedule:validate), and planned changes (cancelled, changed time, extra gathering, moved to another date with its
 * reason). A time can repeat weekly, every N weeks, or on given Sundays of the month, and can follow another time
 * (the preparation four days before the Holy Supper) so it moves with it. Only approved times are public.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { GuardedDialog, ViewToggle } from '@eec/content-kit'
import { SLOT_KINDS, type SlotKind, type SlotRecurrence, shortDate } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  SelectField,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

type Slot = {
  id: string
  kind: SlotKind
  labelFr: string
  labelEn: string
  weekday: number
  startTime: string
  endTime: string | null
  placeFr: string
  placeEn: string
  groupId: string | null
  notesFr: string
  notesEn: string
  validated: boolean
  recurrence: SlotRecurrence | null
  anchorSlotId: string | null
  offsetDays: number
}
type Exc = {
  id: string
  date: string
  slotId: string | null
  kind: 'cancelled' | 'changed' | 'extra' | 'moved'
  noteFr: string
  startTime: string | null
  endTime: string | null
  toDate: string | null
  labelFr: string
}
type Form = {
  id?: string
  kind: SlotKind
  labelFr: string
  labelEn: string
  weekday: number
  startTime: string
  endTime: string
  placeFr: string
  placeEn: string
  notesFr: string
  notesEn: string
  rhythm: 'weekly' | 'every' | 'monthly'
  interval: number
  nth: number[]
  anchorSlotId: string
  offsetDays: number
}

const k = (key: string) => `schedule.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
const DAYS = [1, 2, 3, 4, 5, 6, 0]
const KIND_ICON: Record<SlotKind, IconName> = {
  culte: 'church',
  culte_enfants: 'users',
  etude_biblique: 'bookText',
  priere: 'prayer',
  repetition: 'music',
  permanence: 'clock',
  autre: 'calendar',
}
const blank: Form = {
  kind: 'culte',
  labelFr: '',
  labelEn: '',
  weekday: 0,
  startTime: '09:00',
  endTime: '',
  placeFr: '',
  placeEn: '',
  notesFr: '',
  notesEn: '',
  rhythm: 'weekly',
  interval: 2,
  nth: [2],
  anchorSlotId: '',
  offsetDays: 0,
}
const formOf = (s: Slot): Form => ({
  id: s.id,
  kind: s.kind,
  labelFr: s.labelFr,
  labelEn: s.labelEn,
  weekday: s.weekday,
  startTime: s.startTime,
  endTime: s.endTime ?? '',
  placeFr: s.placeFr,
  placeEn: s.placeEn,
  notesFr: s.notesFr,
  notesEn: s.notesEn,
  rhythm:
    s.recurrence?.freq === 'monthly'
      ? 'monthly'
      : s.recurrence?.freq === 'weekly' && (s.recurrence.interval ?? 1) > 1
        ? 'every'
        : 'weekly',
  interval: s.recurrence?.freq === 'weekly' ? (s.recurrence.interval ?? 2) : 2,
  nth: s.recurrence?.freq === 'monthly' ? s.recurrence.nth : [2],
  anchorSlotId: s.anchorSlotId ?? '',
  offsetDays: s.offsetDays,
})

export default function SchedulePage() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'schedule:update')
  const canValidate = hasPermission(me, 'schedule:validate')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [editing, setEditing] = useState<Form | null>(null)
  const [initial, setInitial] = useState('')
  const [excOpen, setExcOpen] = useState(false)
  const [del, setDel] = useState<Slot | null>(null)
  const list = useQuery({
    queryKey: ['schedule'],
    queryFn: () => api<{ slots: Slot[]; exceptions: Exc[] }>('/schedule'),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['schedule'] })
  const dayName = (wd: number, style: 'long' | 'short' = 'long') =>
    new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 4 + wd)),
    )
  const slots = list.data?.slots ?? []
  const open = (f: Form) => {
    setInitial(JSON.stringify(f))
    setEditing(f)
  }

  const rhythmLabel = (s: Slot) => {
    const r = s.recurrence
    if (s.anchorSlotId) {
      const a = slots.find((x) => x.id === s.anchorSlotId)
      const off =
        s.offsetDays === 0
          ? t(k('offset_same'))
          : s.offsetDays < 0
            ? `${-s.offsetDays} ${t(k('offset_before'))}`
            : `${s.offsetDays} ${t(k('offset_after'))}`
      return t(k('follows_label'), {
        name: a ? (locale === 'en' && a.labelEn ? a.labelEn : a.labelFr) : '…',
        offset: off,
      })
    }
    if (r?.freq === 'monthly')
      return t(k('monthly_label'), {
        nth: r.nth
          .map((n) => t(k(n === -1 ? 'nth_last' : `nth_${n}`)))
          .join(` ${t(k('nth_and'))} `),
        day: dayName(s.weekday),
      })
    if (r?.freq === 'weekly' && (r.interval ?? 1) > 1)
      return t(k('every_label'), { n: String(r.interval) })
    return ''
  }

  const save = useMutation({
    mutationFn: (v: Form) => {
      const recurrence: SlotRecurrence | null =
        v.rhythm === 'monthly'
          ? { freq: 'monthly', nth: v.nth as (1 | 2 | 3 | 4 | -1)[] }
          : v.rhythm === 'every'
            ? { freq: 'weekly', interval: v.interval }
            : null
      const body = {
        kind: v.kind,
        labelFr: v.labelFr,
        labelEn: v.labelEn,
        weekday: v.weekday,
        startTime: v.startTime,
        endTime: v.endTime || null,
        placeFr: v.placeFr,
        placeEn: v.placeEn,
        notesFr: v.notesFr,
        notesEn: v.notesEn,
        recurrence,
        anchorSlotId: v.anchorSlotId || null,
        offsetDays: v.anchorSlotId ? v.offsetDays : 0,
      }
      return v.id
        ? api(`/schedule/slots/${v.id}`, { method: 'PATCH', body })
        : api('/schedule/slots', { method: 'POST', body })
    },
    onSuccess: () => {
      setEditing(null)
      say(t(k('saved')))
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const validate = useMutation({
    mutationFn: (a: { id: string; validated: boolean }) =>
      api(`/schedule/slots/${a.id}/validate`, { method: 'POST', body: { validated: a.validated } }),
    onSuccess: (_r, a) => {
      say(t(k(a.validated ? 'approved_toast' : 'unapproved_toast')))
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/schedule/slots/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDel(null)
      say(t(k('deleted')))
      refresh()
    },
  })

  const chip = (s: Slot) =>
    s.validated ? (
      <Badge tone="success">{t(k('approved'))}</Badge>
    ) : (
      <Badge tone="warning">{t(k('pending'))}</Badge>
    )
  const buttons = (s: Slot) => (
    <span className="flex flex-wrap items-center gap-2">
      {canValidate && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => validate.mutate({ id: s.id, validated: !s.validated })}
        >
          {t(k(s.validated ? 'unapprove' : 'approve'))}
        </Button>
      )}
      {canEdit && (
        <Button size="sm" variant="ghost" onClick={() => open(formOf(s))}>
          {t(k('edit'))}
        </Button>
      )}
      {canEdit && (
        <Button size="sm" variant="danger" onClick={() => setDel(s)}>
          {t(k('delete'))}
        </Button>
      )}
    </span>
  )
  const actions = (s: Slot) => (
    <span className="flex flex-wrap items-center gap-2">
      {chip(s)}
      {buttons(s)}
    </span>
  )
  const label = (s: Slot) => (locale === 'en' && s.labelEn ? s.labelEn : s.labelFr)

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle
            value={view}
            onChange={setView}
            label={t(k('title'))}
            options={[
              { id: 'grid', label: t(k('view_grid')), icon: 'gridView' },
              { id: 'list', label: t(k('view_list')), icon: 'layoutList' },
            ]}
          />
          {canEdit && <Button onClick={() => open({ ...blank })}>{t(k('add'))}</Button>}
        </div>
      </header>

      {list.data && slots.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))}>
          {canEdit && <Button onClick={() => open({ ...blank })}>{t(k('add'))}</Button>}
        </EmptyState>
      ) : view === 'grid' ? (
        <ul className="slot-grid">
          {slots.map((s) => (
            <li key={s.id} className="slot-card">
              <div className="slot-card-head">
                <span
                  className="kind-tile"
                  data-tone={
                    s.kind === 'culte'
                      ? 'primary'
                      : s.kind === 'priere'
                        ? 'success'
                        : s.kind === 'etude_biblique'
                          ? 'info'
                          : 'clay'
                  }
                  aria-hidden="true"
                >
                  <Icon name={KIND_ICON[s.kind]} size={20} />
                </span>
                <div className="slot-card-title">
                  <strong>{label(s)}</strong>
                  <span className="text-sm text-ink-muted">
                    {dayName(s.weekday)} · {s.startTime}
                    {s.endTime ? `–${s.endTime}` : ''}
                  </span>
                </div>
                <span className="slot-card-status">{chip(s)}</span>
              </div>
              <div className="slot-card-body">
                {rhythmLabel(s) && <span className="text-sm text-ink-muted">{rhythmLabel(s)}</span>}
                {s.placeFr && <span className="text-sm text-ink-muted">{s.placeFr}</span>}
              </div>
              <div className="slot-card-foot">{buttons(s)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4">
          {DAYS.map((wd) => {
            const day = slots.filter((s) => s.weekday === wd)
            if (!day.length) return null
            return (
              <section key={wd} className="admin-panel">
                <h2 className="text-xl capitalize">{dayName(wd)}</h2>
                <ul className="grid gap-2">
                  {day.map((s) => (
                    <li key={s.id} className="admin-row">
                      <span className="grid">
                        <strong>
                          {s.startTime}
                          {s.endTime ? `–${s.endTime}` : ''} · {label(s)}
                        </strong>
                        <span className="text-sm text-ink-muted">
                          {t(k(`kind_${s.kind}`))}
                          {s.placeFr ? ` · ${s.placeFr}` : ''}
                          {rhythmLabel(s) ? ` · ${rhythmLabel(s)}` : ''}
                        </span>
                      </span>
                      {actions(s)}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      {canEdit && slots.length > 0 && (
        <p className="text-sm text-ink-muted">{t(k('edit_resets'))}</p>
      )}

      <Exceptions
        slots={slots}
        items={list.data?.exceptions ?? []}
        canEdit={canEdit}
        open={excOpen}
        setOpen={setExcOpen}
        refresh={refresh}
      />

      <GuardedDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        dirty={!!editing && JSON.stringify(editing) !== initial}
      >
        {(requestClose) =>
          editing && (
            <form
              className="dialog-body"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(editing)
              }}
            >
              <h2 className="dialog-title">{t(k(editing.id ? 'edit' : 'add'))}</h2>
              <SelectField
                label={t(k('kind'))}
                value={editing.kind}
                onValueChange={(v) => v && setEditing({ ...editing, kind: v as SlotKind })}
                options={SLOT_KINDS.map((x) => ({ value: x, label: t(k(`kind_${x}`)) }))}
              />
              <TextField
                label={t(k('label_fr'))}
                placeholder=""
                icon="church"
                value={editing.labelFr}
                onChange={(e: { target: { value: string } }) =>
                  setEditing({ ...editing, labelFr: e.target.value })
                }
              />
              <TextField
                label={t(k('label_en'))}
                placeholder=""
                icon="language"
                value={editing.labelEn}
                onChange={(e: { target: { value: string } }) =>
                  setEditing({ ...editing, labelEn: e.target.value })
                }
              />
              <SelectField
                label={t(k('weekday'))}
                value={String(editing.weekday)}
                onValueChange={(v) => v && setEditing({ ...editing, weekday: Number(v) })}
                options={DAYS.map((wd) => ({ value: String(wd), label: dayName(wd) }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="field-label">{t(k('start'))}</span>
                  <input
                    className="input"
                    type="time"
                    required
                    value={editing.startTime}
                    onChange={(e) => setEditing({ ...editing, startTime: e.target.value })}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="field-label">{t(k('end'))}</span>
                  <input
                    className="input"
                    type="time"
                    value={editing.endTime}
                    onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
                  />
                </label>
              </div>

              <fieldset className="form-group">
                <SelectField
                  label={t(k('rhythm'))}
                  value={editing.anchorSlotId ? 'follows' : editing.rhythm}
                  onValueChange={(v) =>
                    v &&
                    (v === 'follows'
                      ? setEditing({
                          ...editing,
                          anchorSlotId:
                            slots.find((s) => s.id !== editing.id && !s.anchorSlotId)?.id ?? '',
                        })
                      : setEditing({ ...editing, anchorSlotId: '', rhythm: v as Form['rhythm'] }))
                  }
                  options={[
                    { value: 'weekly', label: t(k('rhythm_weekly')) },
                    { value: 'every', label: t(k('rhythm_every')) },
                    { value: 'monthly', label: t(k('rhythm_monthly')) },
                    ...(slots.some((s) => s.id !== editing.id && !s.anchorSlotId)
                      ? [{ value: 'follows', label: t(k('follows')) }]
                      : []),
                  ]}
                />
                {!editing.anchorSlotId && editing.rhythm === 'every' && (
                  <label className="grid max-w-40 gap-1">
                    <span className="field-label">
                      {t(k('every'))} ({t(k('every_weeks'))})
                    </span>
                    <input
                      className="input"
                      type="number"
                      min={2}
                      max={12}
                      value={editing.interval}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          interval: Math.max(2, Number(e.target.value) || 2),
                        })
                      }
                    />
                  </label>
                )}
                {!editing.anchorSlotId && editing.rhythm === 'monthly' && (
                  <div className="grid gap-1">
                    <span className="field-label">{t(k('which'))}</span>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, -1].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="chip"
                          aria-pressed={editing.nth.includes(n)}
                          onClick={() => {
                            const next = editing.nth.includes(n)
                              ? editing.nth.filter((x) => x !== n)
                              : [...editing.nth, n]
                            if (next.length) setEditing({ ...editing, nth: next })
                          }}
                        >
                          {t(k(n === -1 ? 'nth_last' : `nth_${n}`))}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {editing.anchorSlotId && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label={t(k('follows_which'))}
                      value={editing.anchorSlotId}
                      onValueChange={(v) => v && setEditing({ ...editing, anchorSlotId: v })}
                      options={slots
                        .filter((s) => s.id !== editing.id && !s.anchorSlotId)
                        .map((s) => ({
                          value: s.id,
                          label: `${label(s)} (${dayName(s.weekday)})`,
                        }))}
                    />
                    <label className="grid gap-1">
                      <span className="field-label">{t(k('offset'))}</span>
                      <select
                        className="input"
                        value={editing.offsetDays}
                        onChange={(e) =>
                          setEditing({ ...editing, offsetDays: Number(e.target.value) })
                        }
                      >
                        {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3].map((n) => (
                          <option key={n} value={n}>
                            {n === 0
                              ? t(k('offset_same'))
                              : n < 0
                                ? `${-n} ${t(k('offset_before'))}`
                                : `${n} ${t(k('offset_after'))}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-sm text-ink-muted sm:col-span-2">{t(k('follows_help'))}</p>
                  </div>
                )}
              </fieldset>

              <TextField
                label={t(k('place_fr'))}
                placeholder=""
                icon="location"
                value={editing.placeFr}
                onChange={(e: { target: { value: string } }) =>
                  setEditing({ ...editing, placeFr: e.target.value })
                }
              />
              <TextField
                label={t(k('notes_fr'))}
                placeholder=""
                icon="info"
                value={editing.notesFr}
                onChange={(e: { target: { value: string } }) =>
                  setEditing({ ...editing, notesFr: e.target.value })
                }
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

      <GuardedDialog open={!!del} onClose={() => setDel(null)} dirty={false}>
        {(requestClose) => (
          <div className="dialog-body">
            <h2 className="dialog-title">{t(k('delete_t'))}</h2>
            <p>{t(k('delete_p'))}</p>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={requestClose}>
                {t(k('cancel'))}
              </Button>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={() => del && remove.mutate(del.id)}
              >
                {t(k('delete'))}
              </Button>
            </div>
          </div>
        )}
      </GuardedDialog>
    </div>
  )
}

function Exceptions({
  slots,
  items,
  canEdit,
  open,
  setOpen,
  refresh,
}: {
  slots: Slot[]
  items: Exc[]
  canEdit: boolean
  open: boolean
  setOpen: (o: boolean) => void
  refresh: () => void
}) {
  const { t, locale } = useLocale()
  const empty = {
    date: '',
    slotId: 'all',
    kind: 'cancelled',
    noteFr: '',
    startTime: '',
    endTime: '',
    labelFr: '',
    toDate: '',
  }
  const [f, setF] = useState(empty)
  const dirty = JSON.stringify(f) !== JSON.stringify(empty)
  const add = useMutation({
    mutationFn: () =>
      api('/schedule/exceptions', {
        method: 'POST',
        body: {
          date: f.date,
          slotId: f.slotId === 'all' ? null : f.slotId,
          kind: f.kind,
          noteFr: f.noteFr,
          startTime: f.startTime || null,
          endTime: f.endTime || null,
          labelFr: f.labelFr,
          toDate: f.toDate || null,
        },
      }),
    onSuccess: () => {
      setOpen(false)
      setF(empty)
      say(t(k('exc_added')))
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/schedule/exceptions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('exc_removed')))
      refresh()
    },
  })
  const day = (d: string) => shortDate(`${d}T12:00:00Z`, locale, 'UTC')
  return (
    <section className="admin-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{t(k('exc_t'))}</h2>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {t(k('exc_add'))}
          </Button>
        )}
      </div>
      <p className="text-sm text-ink-muted">{t(k('exc_help'))}</p>
      {items.length === 0 && <p className="text-ink-muted">{t(k('exc_none'))}</p>}
      <ul className="grid gap-2">
        {items.map((e) => (
          <li key={e.id} className="admin-row">
            <span className="grid">
              <strong>
                {day(e.date)}
                {e.kind === 'moved' && e.toDate ? ` → ${day(e.toDate)}` : ''}
              </strong>
              <span className="text-sm text-ink-muted">
                {t(k(`exc_${e.kind}`))}
                {e.kind === 'extra' ? ` · ${e.labelFr}` : ''}
                {e.startTime ? ` · ${e.startTime}${e.endTime ? `–${e.endTime}` : ''}` : ''}
                {e.slotId
                  ? ` · ${slots.find((s) => s.id === e.slotId)?.labelFr ?? ''}`
                  : ` · ${t(k('exc_all'))}`}
                {e.noteFr ? ` · ${e.noteFr}` : ''}
              </span>
            </span>
            {canEdit && (
              <Button size="sm" variant="danger" onClick={() => remove.mutate(e.id)}>
                {t(k('exc_remove'))}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <GuardedDialog
        open={open}
        onClose={() => {
          setOpen(false)
          setF(empty)
        }}
        dirty={dirty}
      >
        {(requestClose) => (
          <form
            className="dialog-body"
            onSubmit={(e) => {
              e.preventDefault()
              add.mutate()
            }}
          >
            <h2 className="dialog-title">{t(k('exc_add'))}</h2>
            <SelectField
              label={t(k('exc_kind'))}
              value={f.kind}
              onValueChange={(v) => v && setF({ ...f, kind: v })}
              options={(['cancelled', 'moved', 'changed', 'extra'] as const).map((x) => ({
                value: x,
                label: t(k(`exc_${x}`)),
              }))}
            />
            <label className="grid gap-1">
              <span className="field-label">{t(k('exc_date'))}</span>
              <input
                className="input"
                type="date"
                required
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </label>
            {f.kind !== 'extra' && (
              <SelectField
                label={t(k('exc_slot'))}
                value={f.slotId}
                onValueChange={(v) => v && setF({ ...f, slotId: v })}
                options={[
                  { value: 'all', label: t(k('exc_all')) },
                  ...slots.map((s) => ({ value: s.id, label: `${s.labelFr} (${s.startTime})` })),
                ]}
              />
            )}
            {f.kind === 'moved' && (
              <label className="grid gap-1">
                <span className="field-label">{t(k('exc_to'))}</span>
                <input
                  className="input"
                  type="date"
                  required
                  value={f.toDate}
                  onChange={(e) => setF({ ...f, toDate: e.target.value })}
                />
              </label>
            )}
            {f.kind === 'extra' && (
              <TextField
                label={t(k('exc_label'))}
                placeholder=""
                icon="church"
                value={f.labelFr}
                onChange={(e: { target: { value: string } }) =>
                  setF({ ...f, labelFr: e.target.value })
                }
              />
            )}
            {(f.kind === 'changed' || f.kind === 'extra') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="field-label">{t(k('start'))}</span>
                  <input
                    className="input"
                    type="time"
                    required
                    value={f.startTime}
                    onChange={(e) => setF({ ...f, startTime: e.target.value })}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="field-label">{t(k('end'))}</span>
                  <input
                    className="input"
                    type="time"
                    value={f.endTime}
                    onChange={(e) => setF({ ...f, endTime: e.target.value })}
                  />
                </label>
              </div>
            )}
            <TextField
              label={t(k(f.kind === 'cancelled' || f.kind === 'moved' ? 'exc_reason' : 'exc_note'))}
              placeholder=""
              icon="info"
              hint={
                f.kind === 'cancelled' || f.kind === 'moved' ? t(k('exc_reason_help')) : undefined
              }
              value={f.noteFr}
              onChange={(e: { target: { value: string } }) =>
                setF({ ...f, noteFr: e.target.value })
              }
            />
            <div className="dialog-actions">
              <Button type="button" variant="secondary" onClick={requestClose}>
                {t(k('cancel'))}
              </Button>
              <Button type="submit" loading={add.isPending}>
                {t(k('save'))}
              </Button>
            </div>
          </form>
        )}
      </GuardedDialog>
    </section>
  )
}
