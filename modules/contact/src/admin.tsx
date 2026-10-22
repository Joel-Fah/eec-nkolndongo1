/**
 * Messages (admin, /m/contact): the inbox of the contact form. New / in progress / handled, take charge, internal notes,
 * and reply with a WhatsApp, e-mail or phone link (we send no e-mail). Prayer requests appear only to people allowed to
 * read them (contact:read-sensitive); they are never exported.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog } from '@eec/content-kit'
import type { MessageKey } from '@eec/i18n'
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

const k = (key: string) => `contact.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })

type Row = {
  id: string
  name: string
  category: string
  status: 'new' | 'progress' | 'handled'
  sensitive: boolean
  assignee: string | null
  createdAt: string
  preview: string
}
type Detail = {
  message: {
    id: string
    name: string
    email: string
    phone: string
    category: string
    subject: string
    message: string
    sensitive: boolean
    status: Row['status']
    createdAt: string
    consentAt: string
  }
  assignee: string | null
  notes: { id: string; body: string; author: string | null; createdAt: string }[]
}

/** This week, last week, then one group per month. Monday starts the week; dates are the visitor's local ones. */
function groupOf(
  iso: string,
  now: Date,
  locale: string,
): { key: string; label: string; order: number } {
  const d = new Date(iso)
  const monday = (x: Date) => {
    const c = new Date(x.getFullYear(), x.getMonth(), x.getDate())
    c.setDate(c.getDate() - ((c.getDay() + 6) % 7))
    return c.getTime()
  }
  const weeks = Math.round((monday(now) - monday(d)) / (7 * 86_400_000))
  if (weeks <= 0) return { key: 'w0', label: 'this_week', order: 0 }
  if (weeks === 1) return { key: 'w1', label: 'last_week', order: 1 }
  const m = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
  return {
    key: `m${d.getFullYear()}-${d.getMonth()}`,
    label: m,
    order: 2 + (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()),
  }
}

/** The date window of a preset (local dates), or the two chosen days. */
function windowOf(
  range: string,
  custom: { from: string; to: string },
): { from?: string; to?: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n)
  if (range === 'today') return { from: iso(now), to: iso(now) }
  if (range === 'week') return { from: iso(daysAgo((now.getDay() + 6) % 7)), to: iso(now) }
  if (range === 'month')
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
  if (range === '90') return { from: iso(daysAgo(90)), to: iso(now) }
  if (range === 'custom') return { from: custom.from || undefined, to: custom.to || undefined }
  return {}
}

export default function ContactInbox() {
  const { t, locale } = useLocale()
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('all')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useQuery({
    queryKey: ['contact', status, range, custom],
    queryFn: () => {
      const q = new URLSearchParams()
      if (status !== 'all') q.set('status', status)
      const w = windowOf(range, custom)
      if (w.from) q.set('from', w.from)
      if (w.to) q.set('to', w.to)
      return api<{ items: Row[] }>(`/contact${q.size ? `?${q}` : ''}`)
    },
  })
  const items = list.data?.items ?? []
  const now = new Date()
  const groups = new Map<string, { label: string; order: number; rows: Row[] }>()
  for (const m of items) {
    const g = groupOf(m.createdAt, now, locale)
    const label = g.label === 'this_week' || g.label === 'last_week' ? t(k(g.label)) : g.label
    const cur = groups.get(g.key) ?? { label, order: g.order, rows: [] }
    cur.rows.push(m)
    groups.set(g.key, cur)
  }
  const ordered = [...groups.values()].sort((a, b) => a.order - b.order)
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .map((x) => x[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        <SelectField
          label={t(k('filter'))}
          value={status}
          onValueChange={(v) => v && setStatus(v)}
          options={['all', 'new', 'progress', 'handled'].map((s) => ({
            value: s,
            label: t(k(`status_${s}`)),
          }))}
        />
      </header>
      {list.data && items.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
      ) : (
        <div className="inbox" data-open={openId ? '' : undefined}>
          <nav className="inbox-list" aria-label={t(k('title'))}>
            {ordered.map((g) => (
              <section key={g.label} className="inbox-group">
                <h2 className="inbox-group-h">
                  {g.label}
                  <span>{g.rows.length}</span>
                </h2>
                <ul>
                  {g.rows.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="inbox-row"
                        data-active={openId === m.id ? '' : undefined}
                        data-new={m.status === 'new' ? '' : undefined}
                        aria-current={openId === m.id ? 'true' : undefined}
                        onClick={() => setOpenId(m.id)}
                      >
                        <span className="inbox-avatar" aria-hidden="true">
                          {m.sensitive ? <Icon name="prayer" size={20} /> : initials(m.name)}
                        </span>
                        <span className="inbox-main">
                          <span className="inbox-top">
                            <strong>{m.name}</strong>
                            <time dateTime={m.createdAt}>{when(m.createdAt)}</time>
                          </span>
                          <span className="inbox-sub">{t(k(`cat_${m.category}`))}</span>
                          <span className="inbox-prev">
                            {m.sensitive ? t(k('sensitive_hidden')) : m.preview}
                          </span>
                        </span>
                        <span className="inbox-tags">
                          {m.status !== 'new' && (
                            <Badge tone={m.status === 'handled' ? 'success' : undefined}>
                              {t(k(`status_${m.status}`))}
                            </Badge>
                          )}
                          {m.assignee && <Badge>{m.assignee}</Badge>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div className="inbox-pane">
            {openId ? (
              <MessageView key={openId} id={openId} onClose={() => setOpenId(null)} />
            ) : (
              <div className="inbox-empty">
                <Icon name="mail" size={24} />
                <p>{t(k('pick'))}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MessageView({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canHandle = hasPermission(me, 'contact:handle')
  const canDelete = hasPermission(me, 'contact:delete')
  const [note, setNote] = useState('')
  const [del, setDel] = useState(false)
  const q = useQuery({
    queryKey: ['contact-one', id],
    queryFn: () => api<Detail>(`/contact/${id}`),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['contact'] })
    qc.invalidateQueries({ queryKey: ['contact-one', id] })
  }
  const patch = useMutation({
    mutationFn: (body: { status?: Row['status']; assign?: 'me' | 'none' }) =>
      api(`/contact/${id}`, { method: 'PATCH', body }),
    onSuccess: refresh,
    onError: () => notify(t(k('error')), 'error'),
  })
  const addNote = useMutation({
    mutationFn: () => api(`/contact/${id}/notes`, { method: 'POST', body: { body: note } }),
    onSuccess: () => {
      setNote('')
      refresh()
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/contact/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh()
      onClose()
    },
  })
  const m = q.data?.message
  const digits = m?.phone.replace(/[^\d]/g, '') ?? ''
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  return (
    <article className="inbox-view">
      <header className="inbox-view-head">
        <Button variant="ghost" size="sm" className="inbox-back" onClick={onClose}>
          <Icon name="chevronLeft" size={16} />
          {t(k('back'))}
        </Button>
        <h2 className="text-2xl">{m?.name ?? '…'}</h2>
        {m && (
          <p className="text-sm text-ink-muted">
            {t(k(`cat_${m.category}`))} · {when(m.createdAt)}
            {m.subject ? ` · ${m.subject}` : ''}
          </p>
        )}
      </header>
      {m && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {m.sensitive && <Badge tone="warning">{t(k('sensitive'))}</Badge>}
            <Badge
              tone={m.status === 'new' ? 'info' : m.status === 'handled' ? 'success' : undefined}
            >
              {t(k(`status_${m.status}`))}
            </Badge>
            {q.data?.assignee && <Badge>{t(k('assigned'), { name: q.data.assignee })}</Badge>}
          </div>
          <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-4">{m.message}</p>
          <div className="flex flex-wrap gap-2">
            {m.email && (
              <a className="btn btn-secondary btn-sm" href={`mailto:${m.email}`}>
                <Icon name="mail" size={16} />
                {m.email}
              </a>
            )}
            {m.phone && (
              <>
                <a
                  className="btn btn-secondary btn-sm"
                  href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}
                >
                  <Icon name="phone" size={16} />
                  {m.phone}
                </a>
                <a
                  className="btn btn-secondary btn-sm"
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="whatsapp" size={16} />
                  WhatsApp
                  <Icon name="external" size={16} />
                </a>
              </>
            )}
          </div>
          <p className="text-sm text-ink-muted">
            {t(k('consent_at'), { date: when(m.consentAt) })}
          </p>
          {canHandle && (
            <div className="flex flex-wrap gap-2">
              {m.status !== 'progress' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => patch.mutate({ status: 'progress', assign: 'me' })}
                >
                  {t(k('take'))}
                </Button>
              )}
              {m.status !== 'handled' && (
                <Button size="sm" onClick={() => patch.mutate({ status: 'handled' })}>
                  {t(k('mark_handled'))}
                </Button>
              )}
              {m.status === 'handled' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => patch.mutate({ status: 'progress' })}
                >
                  {t(k('reopen'))}
                </Button>
              )}
              {q.data?.assignee && (
                <Button variant="ghost" size="sm" onClick={() => patch.mutate({ assign: 'none' })}>
                  {t(k('release'))}
                </Button>
              )}
            </div>
          )}
          <section className="grid gap-2">
            <h3 className="text-lg">{t(k('notes'))}</h3>
            {q.data?.notes.length === 0 && (
              <p className="text-sm text-ink-muted">{t(k('notes_none'))}</p>
            )}
            <ul className="grid gap-2">
              {q.data?.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-surface-2 p-3">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-ink-muted">
                    {n.author ?? '—'} · {when(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
            {canHandle && (
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (note.trim()) addNote.mutate()
                }}
              >
                <TextField
                  label={t(k('note_label'))}
                  placeholder={t(k('note_ph'))}
                  textarea
                  value={note}
                  onChange={(e: { target: { value: string } }) => setNote(e.target.value)}
                  maxLength={1000}
                />
                <div>
                  <Button type="submit" variant="secondary" size="sm" loading={addNote.isPending}>
                    {t(k('note_add'))}
                  </Button>
                </div>
              </form>
            )}
          </section>
          {canDelete && (
            <div>
              <Button variant="danger" size="sm" onClick={() => setDel(true)}>
                {t(k('delete'))}
              </Button>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        title={t(k('delete_t'))}
        text={t(k('delete_p'))}
        confirmLabel={t(k('delete'))}
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </article>
  )
}
