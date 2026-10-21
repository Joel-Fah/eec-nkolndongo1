/**
 * Cultes et horaires (admin, /m/schedule): the weekly rhythm by day, approve/unapprove (schedule:validate), and
 * planned changes (cancelled, changed time, extra gathering). Only approved times are public.
 */
import { Dialog } from '@base-ui/react/dialog'
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { SLOT_KINDS, type SlotKind } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, EmptyState, SelectField, TextField, toastManager } from '@eec/ui/react'
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
}
type Exc = {
  id: string
  date: string
  slotId: string | null
  kind: 'cancelled' | 'changed' | 'extra'
  noteFr: string
  startTime: string | null
  endTime: string | null
  labelFr: string
}

const k = (key: string) => `schedule.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
const DAYS = [1, 2, 3, 4, 5, 6, 0]
const blank = {
  kind: 'culte' as SlotKind,
  labelFr: '',
  labelEn: '',
  weekday: 0,
  startTime: '09:00',
  endTime: '' as string | null,
  placeFr: '',
  placeEn: '',
  notesFr: '',
  notesEn: '',
}

export default function SchedulePage() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'schedule:update')
  const canValidate = hasPermission(me, 'schedule:validate')
  const [editing, setEditing] = useState<null | (typeof blank & { id?: string })>(null)
  const [excOpen, setExcOpen] = useState(false)
  const [del, setDel] = useState<Slot | null>(null)
  const list = useQuery({
    queryKey: ['schedule'],
    queryFn: () => api<{ slots: Slot[]; exceptions: Exc[] }>('/schedule'),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['schedule'] })
  const dayName = (wd: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 4 + wd)),
    )
  const slots = list.data?.slots ?? []

  const save = useMutation({
    mutationFn: (v: typeof blank & { id?: string }) => {
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

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {canEdit && <Button onClick={() => setEditing({ ...blank })}>{t(k('add'))}</Button>}
      </header>

      {list.data && slots.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))}>
          {canEdit && <Button onClick={() => setEditing({ ...blank })}>{t(k('add'))}</Button>}
        </EmptyState>
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
                          {s.endTime ? `–${s.endTime}` : ''} ·{' '}
                          {locale === 'en' && s.labelEn ? s.labelEn : s.labelFr}
                        </strong>
                        <span className="text-sm text-ink-muted">
                          {t(k(`kind_${s.kind}`))}
                          {s.placeFr ? ` · ${s.placeFr}` : ''}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {s.validated ? (
                          <Badge tone="success">{t(k('approved'))}</Badge>
                        ) : (
                          <Badge tone="warning">{t(k('pending'))}</Badge>
                        )}
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing({ ...s, endTime: s.endTime ?? '' })}
                          >
                            {t(k('edit'))}
                          </Button>
                        )}
                        {canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => setDel(s)}>
                            {t(k('delete'))}
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {canEdit && <p className="text-sm text-ink-muted">{t(k('edit_resets'))}</p>}
        </div>
      )}

      <Exceptions
        slots={slots}
        items={list.data?.exceptions ?? []}
        canEdit={canEdit}
        open={excOpen}
        setOpen={setExcOpen}
        refresh={refresh}
        dayName={dayName}
      />

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="eec-backdrop eec-overlay" />
          <Dialog.Popup className="dialog eec-dialog">
            {editing && (
              <form
                className="dialog-body"
                onSubmit={(e) => {
                  e.preventDefault()
                  save.mutate(editing)
                }}
              >
                <Dialog.Title className="dialog-title">
                  {t(k(editing.id ? 'edit' : 'add'))}
                </Dialog.Title>
                <SelectField
                  label={t(k('kind'))}
                  value={editing.kind}
                  onValueChange={(v) => v && setEditing({ ...editing, kind: v as SlotKind })}
                  options={SLOT_KINDS.map((x) => ({ value: x, label: t(k(`kind_${x}`)) }))}
                />
                <TextField
                  label={t(k('label_fr'))}
                  placeholder=""
                  value={editing.labelFr}
                  onChange={(e: { target: { value: string } }) =>
                    setEditing({ ...editing, labelFr: e.target.value })
                  }
                />
                <TextField
                  label={t(k('label_en'))}
                  placeholder=""
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
                      value={editing.endTime ?? ''}
                      onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
                    />
                  </label>
                </div>
                <TextField
                  label={t(k('place_fr'))}
                  placeholder=""
                  value={editing.placeFr}
                  onChange={(e: { target: { value: string } }) =>
                    setEditing({ ...editing, placeFr: e.target.value })
                  }
                />
                <TextField
                  label={t(k('place_en'))}
                  placeholder=""
                  value={editing.placeEn}
                  onChange={(e: { target: { value: string } }) =>
                    setEditing({ ...editing, placeEn: e.target.value })
                  }
                />
                <TextField
                  label={t(k('notes_fr'))}
                  placeholder=""
                  value={editing.notesFr}
                  onChange={(e: { target: { value: string } }) =>
                    setEditing({ ...editing, notesFr: e.target.value })
                  }
                />
                <div className="dialog-actions">
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
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

      <Dialog.Root open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="eec-backdrop eec-overlay" />
          <Dialog.Popup className="dialog eec-dialog">
            <div className="dialog-body">
              <Dialog.Title className="dialog-title">{t(k('delete_t'))}</Dialog.Title>
              <p>{t(k('delete_p'))}</p>
              <div className="dialog-actions">
                <Button variant="secondary" onClick={() => setDel(null)}>
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
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
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
  dayName,
}: {
  slots: Slot[]
  items: Exc[]
  canEdit: boolean
  open: boolean
  setOpen: (o: boolean) => void
  refresh: () => void
  dayName: (n: number) => string
}) {
  const { t, locale } = useLocale()
  const [f, setF] = useState({
    date: '',
    slotId: 'all',
    kind: 'cancelled',
    noteFr: '',
    startTime: '',
    endTime: '',
    labelFr: '',
  })
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
        },
      }),
    onSuccess: () => {
      setOpen(false)
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
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    )
  void dayName
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
              <strong>{fmt(e.date)}</strong>
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
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(e.id)}>
                {t(k('exc_remove'))}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="eec-backdrop eec-overlay" />
          <Dialog.Popup className="dialog eec-dialog">
            <form
              className="dialog-body"
              onSubmit={(e) => {
                e.preventDefault()
                add.mutate()
              }}
            >
              <Dialog.Title className="dialog-title">{t(k('exc_add'))}</Dialog.Title>
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
              <SelectField
                label={t(k('exc_kind'))}
                value={f.kind}
                onValueChange={(v) => v && setF({ ...f, kind: v })}
                options={(['cancelled', 'changed', 'extra'] as const).map((x) => ({
                  value: x,
                  label: t(k(`exc_${x}`)),
                }))}
              />
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
              {f.kind === 'extra' && (
                <TextField
                  label={t(k('exc_label'))}
                  placeholder=""
                  value={f.labelFr}
                  onChange={(e: { target: { value: string } }) =>
                    setF({ ...f, labelFr: e.target.value })
                  }
                />
              )}
              {f.kind !== 'cancelled' && (
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
                label={t(k('exc_note'))}
                placeholder=""
                value={f.noteFr}
                onChange={(e: { target: { value: string } }) =>
                  setF({ ...f, noteFr: e.target.value })
                }
              />
              <div className="dialog-actions">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  {t(k('cancel'))}
                </Button>
                <Button type="submit" loading={add.isPending}>
                  {t(k('save'))}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
