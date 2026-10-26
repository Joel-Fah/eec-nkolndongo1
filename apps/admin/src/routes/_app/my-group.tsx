import { api, useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { avatarSvg } from '@eec/ui/avatar-art'
import { Badge, Button, EmptyState, SelectField, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Illustration } from '../../components/Illustration'
import { Gate, notify, PageHeader, Sheet } from '../../components/kit'

export const Route = createFileRoute('/_app/my-group')({
  component: () => (
    <Gate permission="core:group-roster">
      <MyGroup />
    </Gate>
  ),
})

type Mine = {
  id: string
  nameFr: string
  nameEn: string | null
  members: number
  pending: number
  canManage: boolean
  canExport: boolean
}
type Detail = {
  group: { id: string; nameFr: string; nameEn: string | null }
  canManage: boolean
  canExport: boolean
  members: {
    userId: string
    name: string
    seed: number
    photoUrl: string | null
    titleFr: string | null
    titleEn: string | null
    joinedAt: string
    phone: string | null
  }[]
  requests: { id: string; userId: string; name: string; requestedAt: string; sharePhone: boolean }[]
  stats: { members: number; joinsThisMonth: number; ageBands: Record<string, number> | null }
}

const BANDS = ['under18', '18-25', '26-35', '36-50', '51-65', 'over65']
/** A Cameroon number given without a country code gets 237 for the WhatsApp link. */
const waDigits = (phone: string) => {
  const d = phone.replace(/\D/g, '')
  return d.length === 9 ? `237${d}` : d
}

function MyGroup() {
  const { t, locale } = useLocale()
  const k = (key: string) => t(`admin.mygroup.${key}` as MessageKey)
  const qc = useQueryClient()
  const mine = useQuery({
    queryKey: ['group-space'],
    queryFn: () => api<{ groups: Mine[] }>('/group-space/mine'),
  })
  const list = mine.data?.groups ?? []
  const [picked, setPicked] = useState('')
  const id = picked || list[0]?.id || ''
  const detail = useQuery({
    queryKey: ['group-space', id],
    enabled: !!id,
    queryFn: () => api<Detail>(`/group-space/${id}`),
  })
  const d = detail.data
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['group-space'] })
  }
  const [deciding, setDeciding] = useState<{
    req: Detail['requests'][number]
    approve: boolean
  } | null>(null)
  const [message, setMessage] = useState('')
  const [removing, setRemoving] = useState<Detail['members'][number] | null>(null)
  const [reason, setReason] = useState('')
  const decide = useMutation({
    mutationFn: () =>
      api(`/group-space/requests/${deciding?.req.id}/decide`, {
        body: { approve: deciding?.approve, message },
      }),
    onSuccess: () => {
      notify(k(deciding?.approve ? 'accepted' : 'declined'))
      setDeciding(null)
      setMessage('')
      refresh()
    },
    onError: () => notify(k('error'), { tone: 'danger' }),
  })
  const remove = useMutation({
    mutationFn: () =>
      api(`/group-space/${id}/members/${removing?.userId}`, { method: 'DELETE', body: { reason } }),
    onSuccess: () => {
      notify(k('removed'))
      setRemoving(null)
      setReason('')
      refresh()
    },
    onError: () => notify(k('error'), { tone: 'danger' }),
  })
  const name = (g: { nameFr: string; nameEn: string | null }) =>
    (locale === 'en' && g.nameEn) || g.nameFr
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    )

  if (mine.isSuccess && !list.length)
    return (
      <div className="grid gap-6">
        <PageHeader title={k('title')} lead={k('lead')} />
        <EmptyState title={k('none_t')} text={k('none_p')} art={<Illustration />} />
      </div>
    )
  return (
    <div className="grid gap-6">
      <PageHeader
        title={k('title')}
        lead={k('lead')}
        actions={
          <>
            <Link
              to="/m/$module"
              params={{ module: 'announcements' }}
              className="btn btn-secondary"
            >
              {k('announcements')}
            </Link>
            {d?.canExport && (
              <a className="btn btn-secondary" href={`/api/group-space/${id}/export`}>
                {k('export')}
              </a>
            )}
          </>
        }
      />
      {list.length > 1 && (
        <SelectField
          label={k('group')}
          value={id}
          onValueChange={(v) => v && setPicked(v)}
          options={list.map((g) => ({ value: g.id, label: `${name(g)} (${g.members})` }))}
        />
      )}
      {d && (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label={k('stats')}>
            <div className="admin-panel">
              <p className="text-ink-muted">{k('stat_members')}</p>
              <p className="text-3xl">{d.stats.members}</p>
            </div>
            <div className="admin-panel">
              <p className="text-ink-muted">{k('stat_joins')}</p>
              <p className="text-3xl">{d.stats.joinsThisMonth}</p>
            </div>
            <div className="admin-panel">
              <p className="text-ink-muted">{k('stat_ages')}</p>
              {d.stats.ageBands ? (
                <ul className="text-sm">
                  {BANDS.filter((b) => d.stats.ageBands?.[b]).map((b) => (
                    <li key={b}>
                      {t(`members.age_${b}` as MessageKey)} : {d.stats.ageBands?.[b]}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">{k('stat_ages_hidden')}</p>
              )}
            </div>
          </section>

          <section className="grid gap-3" aria-labelledby="mg-req">
            <h2 id="mg-req" className="text-2xl">
              {k('requests')}
            </h2>
            {!d.requests.length ? (
              <p className="text-ink-muted">{k('requests_none')}</p>
            ) : (
              <ul className="grid gap-2">
                {d.requests.map((r) => (
                  <li
                    key={r.id}
                    className="admin-panel flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="grid">
                      <strong>{r.name}</strong>
                      <span className="text-sm text-ink-muted">
                        {k('asked')} {day(r.requestedAt)}
                        {r.sharePhone ? ` · ${k('shares_phone')}` : ''}
                      </span>
                    </div>
                    {d.canManage && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setDeciding({ req: r, approve: true })}>
                          {k('accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeciding({ req: r, approve: false })}
                        >
                          {k('decline')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-3" aria-labelledby="mg-roster">
            <h2 id="mg-roster" className="text-2xl">
              {k('roster')}
            </h2>
            {!d.members.length ? (
              <EmptyState title={k('roster_empty_t')} text={k('roster_empty_p')} />
            ) : (
              <ul className="grid gap-2">
                {d.members.map((m) => (
                  <li
                    key={m.userId}
                    className="admin-panel flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="acct-id-photo" aria-hidden="true">
                        {m.photoUrl ? (
                          <img src={m.photoUrl} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: our own drawing, built from a number
                          <span dangerouslySetInnerHTML={{ __html: avatarSvg(m.seed) }} />
                        )}
                      </span>
                      <div className="grid">
                        <strong>{m.name}</strong>
                        <span className="text-sm text-ink-muted">
                          {k('joined')} {day(m.joinedAt)}
                          {(locale === 'en' && m.titleEn) || m.titleFr
                            ? ` · ${(locale === 'en' && m.titleEn) || m.titleFr}`
                            : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {m.phone ? (
                        <>
                          <a
                            className="btn btn-secondary btn-sm"
                            href={`tel:${m.phone.replace(/\s/g, '')}`}
                          >
                            {k('call')}
                          </a>
                          <a
                            className="btn btn-secondary btn-sm"
                            href={`https://wa.me/${waDigits(m.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            WhatsApp
                          </a>
                        </>
                      ) : (
                        <Badge tone="info">{k('no_contact')}</Badge>
                      )}
                      {d.canManage && (
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                          {k('remove')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Sheet
        open={!!deciding}
        onOpenChange={(o) => !o && setDeciding(null)}
        title={
          deciding ? `${k(deciding.approve ? 'accept' : 'decline')} : ${deciding.req.name}` : ''
        }
      >
        <p className="text-ink-muted">{k('decide_p')}</p>
        <TextField
          label={k('message')}
          hint={k('message_hint')}
          placeholder={k('message_ph')}
          textarea
          rows={3}
          value={message}
          onChange={(e: { target: { value: string } }) => setMessage(e.target.value)}
          maxLength={300}
        />
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDeciding(null)}>
            {t('admin.common.cancel')}
          </Button>
          <Button loading={decide.isPending} onClick={() => decide.mutate()}>
            {deciding ? k(deciding.approve ? 'accept' : 'decline') : ''}
          </Button>
        </div>
      </Sheet>
      <Sheet
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? `${k('remove')} : ${removing.name}` : ''}
      >
        <p className="text-ink-muted">{k('remove_p')}</p>
        <TextField
          label={k('reason')}
          hint={k('reason_hint')}
          placeholder={k('reason_ph')}
          textarea
          rows={3}
          value={reason}
          onChange={(e: { target: { value: string } }) => setReason(e.target.value)}
          maxLength={300}
        />
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {k('remove')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
