/**
 * Members (admin, /m/members): search and filter, read-only records, CSV export (sensitive, confirmed, audited).
 * Names and contacts are personal data: this screen needs `members:read`, the export `members:export`.
 */
import { Dialog } from '@base-ui/react/dialog'
import { api, DateField, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { avatarSeed, shortDate } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import { avatarSvg } from '@eec/ui/avatar-art'
import type { IconName } from '@eec/ui/icons'
import { Avatar, Badge, Button, Icon, SelectField, TextField, toastManager } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

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
  signIn?: ('google' | 'email')[]
  ageBand?: string | null
  gender?: string | null
  neighbourhood?: string | null
  city?: string | null
  maritalStatus?: string | null
  profession?: string | null
  photoUrl?: string | null
}
type Stats = { byGroup: (Group & { n: number })[] }
type Detail = Row & {
  firstName: string
  lastName: string
  lastSeenAt: string | null
  locale?: string
  consents: {
    kind: 'privacy' | 'news' | 'profile'
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
                  <th scope="col">{t(k('col.sign_in'))}</th>
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
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {(m.signIn ?? []).map((x) => (
                          <Badge key={x} tone={x === 'google' ? 'info' : 'primary'}>
                            {t(k(`sign_${x}`))}
                          </Badge>
                        ))}
                      </span>
                    </td>
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
  const row = (icon: IconName, label: string, value: ReactNode) => (
    <div className="mem-row">
      <span className="mem-row-ico" aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
  const place = d ? [d.neighbourhood, d.city].filter(Boolean).join(', ') : ''
  const hasProfile = !!d && !!(d.ageBand || d.gender || place || d.maritalStatus || d.profession)
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="sheet eec-sheet mem-sheet" data-side="end">
          <div className="dialog-body mem-body">
            <Dialog.Title className="sr-only">{t(k('detail.title'))}</Dialog.Title>
            {!d ? (
              <span className="skeleton h-48" aria-busy="true" />
            ) : (
              <>
                <header className="mem-hero">
                  <span className="mem-photo" aria-hidden="true">
                    {d.photoUrl ? (
                      <img src={d.photoUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: our own drawing, built from a number
                        dangerouslySetInnerHTML={{ __html: avatarSvg(avatarSeed(d.id)) }}
                      />
                    )}
                  </span>
                  <div className="grid gap-2">
                    <p className="mem-name">{d.name}</p>
                    <p className="text-ink-muted">{d.email}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={d.status === 'active' ? 'success' : 'warning'}>
                        {t(k(`status_${d.status}`))}
                      </Badge>
                      {d.ageBand && <Badge tone="info">{t(k(`age_${d.ageBand}`))}</Badge>}
                      {d.city && <Badge tone="gold">{d.city}</Badge>}
                      {d.deletionRequestedAt && (
                        <Badge tone="danger">{t(k('detail.deleting'))}</Badge>
                      )}
                    </div>
                  </div>
                </header>

                <section className="mem-card" aria-labelledby="mem-contact">
                  <h3 id="mem-contact" className="mem-card-t">
                    {t(k('detail.contact'))}
                  </h3>
                  <dl className="mem-rows">
                    {row('mail', t(k('col.email')), d.email)}
                    {row('phone', t(k('col.phone')), d.phone ?? '—')}
                    {row(
                      'shield',
                      t(k('col.sign_in')),
                      <span className="flex flex-wrap gap-1">
                        {(d.signIn ?? []).map((x) => (
                          <Badge key={x} tone={x === 'google' ? 'info' : 'primary'}>
                            {t(k(`sign_${x}`))}
                          </Badge>
                        ))}
                      </span>,
                    )}
                    {row(
                      'language',
                      t(k('detail.language')),
                      d.locale === 'en' ? 'English' : 'Français',
                    )}
                  </dl>
                </section>

                <section className="mem-card" aria-labelledby="mem-profile">
                  <h3 id="mem-profile" className="mem-card-t">
                    {t(k('detail.profile'))}
                  </h3>
                  {hasProfile ? (
                    <dl className="mem-rows">
                      {d.ageBand && row('calendar', t(k('detail.age')), t(k(`age_${d.ageBand}`)))}
                      {d.gender &&
                        row('account', t(k('detail.gender')), t(k(`gender_${d.gender}`)))}
                      {place && row('location', t(k('detail.place')), place)}
                      {d.maritalStatus &&
                        row('couple', t(k('detail.marital')), t(k(`marital_${d.maritalStatus}`)))}
                      {d.profession && row('checklist', t(k('detail.profession')), d.profession)}
                    </dl>
                  ) : (
                    <p className="mem-empty">{t(k('detail.profile_empty'))}</p>
                  )}
                </section>

                <section className="mem-card" aria-labelledby="mem-journey">
                  <h3 id="mem-journey" className="mem-card-t">
                    {t(k('detail.journey'))}
                  </h3>
                  <dl className="mem-rows">
                    {row('calendar', t(k('col.joined')), date(d.joinedAt))}
                    {row(
                      'clock',
                      t(k('detail.last_seen')),
                      d.lastSeenAt ? date(d.lastSeenAt) : '—',
                    )}
                  </dl>
                </section>

                <section className="mem-card" aria-labelledby="mem-groups">
                  <h3 id="mem-groups" className="mem-card-t">
                    {t(k('col.groups'))}
                  </h3>
                  {d.groups.length ? (
                    <ul className="mem-chips">
                      {d.groups.map((g) => (
                        <li key={g.key}>
                          <Badge>{locale === 'en' ? (g.nameEn ?? g.nameFr) : g.nameFr}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mem-empty">{t(k('detail.no_groups'))}</p>
                  )}
                </section>

                <section className="mem-card" aria-labelledby="mem-consents">
                  <h3 id="mem-consents" className="mem-card-t">
                    {t(k('detail.consents'))}
                  </h3>
                  <ul className="mem-consents">
                    {d.consents.map((c) => (
                      <li key={`${c.kind}${c.grantedAt}`}>
                        <span className="grid gap-0.5">
                          <strong>{t(k(`detail.kind_${c.kind}`))}</strong>
                          <span className="text-xs text-ink-muted">
                            {c.withdrawnAt
                              ? t(k('detail.withdrawn'), { date: date(c.withdrawnAt) })
                              : t(k('detail.granted'), { date: date(c.grantedAt) })}{' '}
                            · {t(k('detail.version'), { v: c.policyVersion })}
                          </span>
                        </span>
                        <Badge tone={c.withdrawnAt ? 'warning' : 'success'}>
                          {t(k(c.withdrawnAt ? 'detail.state_off' : 'detail.state_on'))}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
            <div className="dialog-actions mem-actions">
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
