/**
 * Data requests (admin, /m/rights): a person asked to see, correct, erase or object to the use of their data (by phone, in person, in
 * writing). One line each with the legal deadline, what was done, and when it was closed (decision 0052). Members have their own tools in
 * Mon espace; this log is for the people who have no account.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, EmptyState, SelectField, TextField, toastManager } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CHANNELS, KINDS } from './index.ts'

const k = (key: string) => `rights.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })

type Row = {
  id: string
  kind: string
  name: string
  contact: string
  channel: string
  receivedOn: string
  dueOn: string
  status: 'received' | 'in_progress' | 'done' | 'refused'
  outcome: string
  closedOn: string | null
  urgency: 'overdue' | 'soon' | 'open' | 'closed'
}
const TONE = { overdue: 'danger', soon: 'warning', open: 'gold', closed: 'success' } as const
const blank = { kind: 'access', name: '', contact: '', channel: 'phone' }

export default function Rights() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const canHandle = hasPermission(me, 'rights:handle')
  const canDelete = hasPermission(me, 'rights:delete')
  const qc = useQueryClient()
  const [filter, setFilter] = useState('open')
  const [form, setForm] = useState<typeof blank | null>(null)
  const [closing, setClosing] = useState<{
    row: Row
    status: 'done' | 'refused'
    outcome: string
  } | null>(null)
  const list = useQuery({
    queryKey: ['rights', filter],
    queryFn: () => api<{ items: Row[]; deadlineDays: number }>(`/rights?status=${filter}`),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['rights'] })
  const act = useMutation({
    mutationFn: (v: { path: string; method: string; body?: unknown }) =>
      api(v.path, { method: v.method, body: v.body ?? {} }),
    onSuccess: () => {
      notify(t(k('done')))
      setForm(null)
      setClosing(null)
      void refresh()
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${iso}T12:00:00Z`),
    )
  const set = (key: keyof typeof blank) => (e: { target: { value: string } }) =>
    form && setForm({ ...form, [key]: e.target.value })
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl">{t(k('title'))}</h1>
          <p className="max-w-[62ch] text-ink-muted">{t(k('lead'))}</p>
        </div>
        {canHandle && <Button onClick={() => setForm(blank)}>{t(k('new'))}</Button>}
      </header>
      <div className="cm-filters">
        <SelectField
          label={t(k('show'))}
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          options={['open', 'closed', 'all'].map((x) => ({ value: x, label: t(k(`filter_${x}`)) }))}
        />
      </div>
      {form && (
        <form
          className="admin-panel grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            act.mutate({ path: '/rights', method: 'POST', body: form })
          }}
        >
          <div className="cm-filters">
            <SelectField
              label={t(k('kind'))}
              value={form.kind}
              onValueChange={(v) => v && setForm({ ...form, kind: v })}
              options={KINDS.map((x) => ({ value: x, label: t(k(`kind_${x}`)) }))}
            />
            <SelectField
              label={t(k('channel'))}
              value={form.channel}
              onValueChange={(v) => v && setForm({ ...form, channel: v })}
              options={CHANNELS.map((x) => ({ value: x, label: t(k(`channel_${x}`)) }))}
            />
          </div>
          <TextField
            label={t(k('name'))}
            placeholder={t(k('name_ph'))}
            value={form.name}
            onChange={set('name')}
            required
          />
          <TextField
            label={t(k('contact'))}
            hint={t(k('contact_hint'))}
            placeholder={t(k('contact_ph'))}
            value={form.contact}
            onChange={set('contact')}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={act.isPending}>
              {t(k('save'))}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setForm(null)}>
              {t(k('cancel'))}
            </Button>
          </div>
        </form>
      )}
      {list.isSuccess && !list.data.items.length && (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
      )}
      <ul className="cm-list">
        {(list.data?.items ?? []).map((r) => (
          <li key={r.id} className="cm-row cm-rights">
            <div className="cm-who">
              <strong>{r.name}</strong>
              <span className="cm-meta">
                <Badge tone="info">{t(k(`kind_${r.kind}`))}</Badge>
                <span>{t(k(`channel_${r.channel}`))}</span>
                {r.contact && <span>{r.contact}</span>}
              </span>
            </div>
            <div className="cm-cell">
              <span className="cm-label">{t(k('deadline'))}</span>
              <div className="cm-inline">
                <Badge tone={TONE[r.urgency]}>{t(k(`urgency_${r.urgency}`))}</Badge>
                <span>{day(r.dueOn)}</span>
              </div>
              <span className="cm-meta">{t(k('received'), { date: day(r.receivedOn) })}</span>
            </div>
            <div className="cm-cell">
              <span className="cm-label">{t(k('status'))}</span>
              <span>
                {t(k(`status_${r.status}`))}
                {r.closedOn ? ` · ${day(r.closedOn)}` : ''}
              </span>
              {r.outcome && <span className="cm-meta">{r.outcome}</span>}
            </div>
            <div className="cm-actions">
              {canHandle && r.status === 'received' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    act.mutate({
                      path: `/rights/${r.id}`,
                      method: 'PATCH',
                      body: { status: 'in_progress' },
                    })
                  }
                >
                  {t(k('start'))}
                </Button>
              )}
              {canHandle && (r.status === 'received' || r.status === 'in_progress') && (
                <Button
                  size="sm"
                  onClick={() => setClosing({ row: r, status: 'done', outcome: '' })}
                >
                  {t(k('close'))}
                </Button>
              )}
              {canHandle && (r.status === 'done' || r.status === 'refused') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    act.mutate({
                      path: `/rights/${r.id}`,
                      method: 'PATCH',
                      body: { status: 'in_progress' },
                    })
                  }
                >
                  {t(k('reopen'))}
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => act.mutate({ path: `/rights/${r.id}`, method: 'DELETE' })}
                >
                  {t(k('delete'))}
                </Button>
              )}
            </div>
            {closing?.row.id === r.id && (
              <fieldset className="cm-ask" aria-label={t(k('close'))}>
                <SelectField
                  label={t(k('result'))}
                  value={closing.status}
                  onValueChange={(v) =>
                    v && setClosing({ ...closing, status: v as 'done' | 'refused' })
                  }
                  options={['done', 'refused'].map((x) => ({
                    value: x,
                    label: t(k(`result_${x}`)),
                  }))}
                />
                <TextField
                  label={t(k('outcome'))}
                  hint={t(k('outcome_hint'))}
                  placeholder={t(k('outcome_ph'))}
                  value={closing.outcome}
                  onChange={(e: { target: { value: string } }) =>
                    setClosing({ ...closing, outcome: e.target.value })
                  }
                />
                <div className="cm-inline">
                  <Button
                    size="sm"
                    loading={act.isPending}
                    disabled={closing.outcome.trim().length < 3}
                    onClick={() =>
                      act.mutate({
                        path: `/rights/${r.id}`,
                        method: 'PATCH',
                        body: { status: closing.status, outcome: closing.outcome },
                      })
                    }
                  >
                    {t(k('close'))}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setClosing(null)}>
                    {t(k('cancel'))}
                  </Button>
                </div>
              </fieldset>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
