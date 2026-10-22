/**
 * Messages (admin, /m/contact): the inbox of the contact form. New / in progress / handled, take charge, internal notes,
 * and reply with a WhatsApp, e-mail or phone link (we send no e-mail). Prayer requests appear only to people allowed to
 * read them (contact:read-sensitive); they are never exported.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog, GuardedDialog } from '@eec/content-kit'
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

export default function ContactInbox() {
  const { t, locale } = useLocale()
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useQuery({
    queryKey: ['contact', status],
    queryFn: () => api<{ items: Row[] }>(`/contact${status === 'all' ? '' : `?status=${status}`}`),
  })
  const items = list.data?.items ?? []
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  return (
    <div className="grid gap-6">
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
        <ul className="grid gap-2">
          {items.map((m) => (
            <li key={m.id} className="admin-row">
              <button type="button" className="grid text-left" onClick={() => setOpenId(m.id)}>
                <strong>{m.name}</strong>
                <span className="text-sm text-ink-muted">
                  {t(k(`cat_${m.category}`))} · {when(m.createdAt)}
                </span>
                <span className="text-sm text-ink-muted">
                  {m.sensitive ? t(k('sensitive_hidden')) : m.preview}
                </span>
              </button>
              <span className="flex flex-wrap items-center gap-2">
                {m.sensitive && <Badge tone="warning">{t(k('sensitive'))}</Badge>}
                {m.assignee && <Badge>{m.assignee}</Badge>}
                <Badge
                  tone={
                    m.status === 'new' ? 'info' : m.status === 'handled' ? 'success' : undefined
                  }
                >
                  {t(k(`status_${m.status}`))}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
      {openId && <MessageView id={openId} onClose={() => setOpenId(null)} />}
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
    <GuardedDialog open onClose={onClose} dirty={!!note.trim()} wide title={m?.name ?? ''}>
      {(requestClose) => (
        <div className="dialog-body">
          <h2 className="dialog-title">{m?.name}</h2>
          {!m ? (
            <p className="text-ink-muted">…</p>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm text-ink-muted">
                {t(k(`cat_${m.category}`))} · {when(m.createdAt)}
                {m.subject ? ` · ${m.subject}` : ''}
              </p>
              {m.sensitive && <Badge tone="warning">{t(k('sensitive'))}</Badge>}
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
                {q.data?.assignee ? ` · ${t(k('assigned'), { name: q.data.assignee })}` : ''}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch.mutate({ assign: 'none' })}
                    >
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
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        loading={addNote.isPending}
                      >
                        {t(k('note_add'))}
                      </Button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          )}
          <div className="dialog-actions">
            {canDelete && m && (
              <Button variant="danger" onClick={() => setDel(true)}>
                {t(k('delete'))}
              </Button>
            )}
            <Button variant="secondary" onClick={requestClose}>
              {t(k('close'))}
            </Button>
          </div>
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
        </div>
      )}
    </GuardedDialog>
  )
}
