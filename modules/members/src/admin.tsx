/**
 * Members (admin, /m/members): search and filter, read-only records, CSV export (sensitive, confirmed, audited).
 * Names and contacts are personal data: this screen needs `members:read`, the export `members:export`.
 */
import { Dialog } from '@base-ui/react/dialog'
import { api, DateField, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { shortDate } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import { Avatar, Badge, Button, SelectField, TextField, toastManager } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

type Group = { key: string; nameFr: string; nameEn: string | null }
type Row = {
  id: string
  name: string
  email: string
  phone: string | null
  joinedAt: string
  status: string
  deletionRequestedAt: string | null
  groups: Group[]
  news: boolean
}
type Stats = { byGroup: (Group & { n: number })[] }
type Detail = Row & {
  firstName: string
  lastName: string
  lastSeenAt: string | null
  consents: {
    kind: 'privacy' | 'news'
    policyVersion: string
    grantedAt: string
    withdrawnAt: string | null
  }[]
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
const k = (key: string) => `members.${key}` as MessageKey

export default function MembersPage() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const canExport = hasPermission(me, 'members:export')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [status, setStatus] = useState('')
  const [since, setSince] = useState('')
  const [limit, setLimit] = useState(50)
  const [open, setOpen] = useState<string | null>(null)
  const params = new URLSearchParams()
  for (const [key, v] of Object.entries({ q, group, status, since })) if (v) params.set(key, v)
  const stats = useQuery({
    queryKey: ['members-stats'],
    queryFn: () => api<Stats>('/members/stats'),
  })
  const list = useQuery({
    queryKey: ['members', params.toString(), limit],
    queryFn: () => api<{ items: Row[]; more: boolean }>(`/members/list?${params}&limit=${limit}`),
  })
  const items = list.data?.items ?? []
  const date = (d: string) => shortDate(d, locale)
  const gname = (g: Group) => (locale === 'en' ? (g.nameEn ?? g.nameFr) : g.nameFr)

  const exportCsv = async () => {
    if (!confirm(t(k('export_confirm')))) return
    const res = await fetch(`/api/members/export?${params}`, { credentials: 'same-origin' })
    if (!res.ok) {
      toastManager.add({
        title: t(k(res.status === 403 ? 'err.forbidden' : 'err.generic')),
        data: { tone: 'danger' },
      })
      return
    }
    const url = URL.createObjectURL(await res.blob())
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `membres-${new Date().toISOString().slice(0, 10)}.csv`,
    })
    a.click()
    URL.revokeObjectURL(url)
    toastManager.add({ title: t(k('exported')), data: { tone: 'success' } })
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {canExport && (
          <Button variant="secondary" onClick={exportCsv}>
            {t(k('export'))}
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <TextField
            label={t(k('search'))}
            placeholder={t(k('search_ph'))}
            icon="search"
            type="search"
            value={q}
            onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
          />
        </div>
        <SelectField
          label={t(k('group'))}
          value={group || 'all'}
          onValueChange={(v: string | null) => setGroup(!v || v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: t(k('all_groups')) },
            ...(stats.data?.byGroup ?? []).map((g) => ({ value: g.key, label: gname(g) })),
          ]}
        />
        <SelectField
          label={t(k('status'))}
          value={status || 'all'}
          onValueChange={(v: string | null) => setStatus(!v || v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: t(k('all_status')) },
            { value: 'active', label: t(k('status_active')) },
            { value: 'deactivated', label: t(k('status_deactivated')) },
          ]}
        />
        <DateField label={t(k('since'))} value={since} onChange={(v: string) => setSince(v)} />
      </div>

      {list.isPending ? (
        <span className="skeleton h-64" aria-busy="true" />
      ) : items.length ? (
        <>
          <p className="text-sm text-ink-muted" role="status">
            {t(k('count'), { n: String(items.length) })}
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{t(k('col.name'))}</th>
                  <th scope="col">{t(k('col.email'))}</th>
                  <th scope="col">{t(k('col.phone'))}</th>
                  <th scope="col">{t(k('col.joined'))}</th>
                  <th scope="col">{t(k('col.groups'))}</th>
                  <th scope="col">{t(k('col.news'))}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} data-clickable onClick={() => setOpen(m.id)}>
                    <td>
                      <button
                        type="button"
                        className="admin-person admin-person-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(m.id)
                        }}
                      >
                        <Avatar initials={initialsOf(m.name)} />
                        <span className="grid text-start">
                          <span className="font-medium">{m.name}</span>
                          {m.deletionRequestedAt && (
                            <Badge tone="warning">
                              {t(k('deletion'), { date: date(m.deletionRequestedAt) })}
                            </Badge>
                          )}
                        </span>
                      </button>
                    </td>
                    <td>{m.email}</td>
                    <td>{m.phone ?? '—'}</td>
                    <td>{date(m.joinedAt)}</td>
                    <td>{m.groups.map(gname).join(', ') || '—'}</td>
                    <td>{t(k(m.news ? 'news_yes' : 'news_no'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.data?.more && (
            <div>
              <Button variant="secondary" onClick={() => setLimit((n) => n + 50)}>
                {t(k('more'))}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="grid justify-items-center gap-2 rounded-lg bg-surface-2 p-10 text-center">
          <p className="text-xl font-medium">{t(k('empty_title'))}</p>
          <p className="max-w-[48ch] text-ink-muted">{t(k('empty_text'))}</p>
        </div>
      )}
      {open && <DetailSheet id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function DetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, locale } = useLocale()
  const data = useQuery({
    queryKey: ['members', 'detail', id],
    queryFn: () => api<Detail>(`/members/detail/${id}`),
  })
  const d = data.data
  const date = (v: string) => shortDate(v, locale)
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="sheet eec-sheet" data-side="end">
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{t(k('detail.title'))}</Dialog.Title>
            {!d ? (
              <span className="skeleton h-48" aria-busy="true" />
            ) : (
              <div className="grid gap-4">
                <div>
                  <p className="text-2xl">{d.name}</p>
                  <p className="text-ink-muted">{d.email}</p>
                  {d.phone && <p className="text-ink-muted">{d.phone}</p>}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-ink-muted">{t(k('col.joined'))}</dt>
                  <dd>{date(d.joinedAt)}</dd>
                  <dt className="text-ink-muted">{t(k('detail.last_seen'))}</dt>
                  <dd>{d.lastSeenAt ? date(d.lastSeenAt) : '—'}</dd>
                  <dt className="text-ink-muted">{t(k('status'))}</dt>
                  <dd>{t(k(`status_${d.status}`))}</dd>
                </dl>
                <div>
                  <h3 className="text-lg">{t(k('col.groups'))}</h3>
                  {d.groups.length ? (
                    <ul className="text-sm">
                      {d.groups.map((g) => (
                        <li key={g.key}>{locale === 'en' ? (g.nameEn ?? g.nameFr) : g.nameFr}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">{t(k('detail.no_groups'))}</p>
                  )}
                </div>
                <div>
                  <h3 className="text-lg">{t(k('detail.consents'))}</h3>
                  <ul className="grid gap-1 text-sm">
                    {d.consents.map((c) => (
                      <li key={`${c.kind}${c.grantedAt}`}>
                        {t(k(`detail.kind_${c.kind}`))} —{' '}
                        {c.withdrawnAt
                          ? t(k('detail.withdrawn'), { date: date(c.withdrawnAt) })
                          : t(k('detail.granted'), { date: date(c.grantedAt) })}{' '}
                        · {t(k('detail.version'), { v: c.policyVersion })}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="dialog-actions">
              <Dialog.Close className="btn btn-secondary">
                {locale === 'fr' ? 'Fermer' : 'Close'}
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
