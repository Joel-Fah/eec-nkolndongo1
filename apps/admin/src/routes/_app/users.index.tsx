import { ApiError, api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Avatar, Badge, Button, EmptyState, SelectField, TextField } from '@eec/ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useDeferredValue, useState } from 'react'
import { Illustration } from '../../components/Illustration'
import { CopyLink, fmt, Gate, notify, PageHeader, Sheet } from '../../components/kit'
import { bi, type Role, type UserRow } from '../../lib/types'

export const Route = createFileRoute('/_app/users/')({
  component: () => (
    <Gate permission="core:users-read">
      <Users />
    </Gate>
  ),
})

const statusTone = { active: 'success', invited: 'info', deactivated: 'warning' } as const
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

function Users() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [inviting, setInviting] = useState(false)
  const query = useDeferredValue(q)
  const params = new URLSearchParams(
    Object.entries({ q: query, role, status }).filter(([, v]) => v),
  )
  const users = useQuery({
    queryKey: ['users', query, role, status],
    queryFn: () => api<{ users: UserRow[] }>(`/users?${params}`),
  })
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ roles: Role[] }>('/roles'),
    enabled: hasPermission(me, 'core:roles-read'),
  })
  const filtered = !!(query || role || status)

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('admin.users.title')}
        lead={t('admin.users.lead')}
        actions={
          hasPermission(me, 'core:users-invite') && (
            <Button onClick={() => setInviting(true)}>{t('admin.users.invite')}</Button>
          )
        }
      />
      <div className="admin-filters">
        <TextField
          label={t('nav.search')}
          placeholder={t('admin.common.search_ph')}
          value={q}
          onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
          type="search"
        />
        {roles.data && (
          <SelectField
            label={t('admin.users.filter_role')}
            value={role || '__all'}
            onValueChange={(v) => setRole(v && v !== '__all' ? v : '')}
            options={[
              { value: '__all', label: t('admin.common.all') },
              ...roles.data.roles.map((r) => ({
                value: r.key,
                label: bi(r.nameFr, r.nameEn, locale),
              })),
            ]}
          />
        )}
        <SelectField
          label={t('admin.users.filter_status')}
          value={status || '__all'}
          onValueChange={(v) => setStatus(v && v !== '__all' ? v : '')}
          options={[
            { value: '__all', label: t('admin.common.all') },
            ...(['active', 'invited', 'deactivated'] as const).map((s) => ({
              value: s,
              label: t(`admin.status.${s}`),
            })),
          ]}
        />
      </div>

      {users.data && users.data.users.length === 0 ? (
        <EmptyState
          title={filtered ? t('admin.common.empty_filtered') : t('admin.users.empty_title')}
          text={filtered ? undefined : t('admin.users.empty_text')}
          art={<Illustration name="community" />}
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.users.col_name')}</th>
                <th scope="col">{t('admin.users.col_roles')}</th>
                <th scope="col">{t('admin.users.col_status')}</th>
                <th scope="col">{t('admin.users.col_last')}</th>
              </tr>
            </thead>
            <tbody>
              {(users.data?.users ?? []).map((u) => (
                <tr
                  key={u.id}
                  data-clickable
                  onClick={() => navigate({ to: '/users/$id', params: { id: u.id } })}
                >
                  <td>
                    <a
                      className="admin-person"
                      href={`/admin/users/${u.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate({ to: '/users/$id', params: { id: u.id } })
                      }}
                    >
                      <Avatar initials={initials(u.name)} />
                      <span className="grid">
                        <span className="font-medium">{u.name}</span>
                        <span className="text-sm text-ink-muted">{u.email}</span>
                      </span>
                    </a>
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {u.roles.length ? (
                        u.roles.map((g) => (
                          <Badge key={g.id} tone={g.roleKey === 'super-admin' ? 'gold' : 'primary'}>
                            {bi(g.roleFr, g.roleEn, locale)}
                            {g.groupId ? ` · ${bi(g.groupFr, g.groupEn, locale)}` : ''}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-ink-muted">{t('admin.users.no_roles')}</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <Badge tone={statusTone[u.status]}>
                      {t(`admin.status.${u.status}` as MessageKey)}
                    </Badge>
                  </td>
                  <td className="text-sm text-ink-muted">
                    {u.lastSeenAt ? fmt(u.lastSeenAt, locale) : t('admin.common.never')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Invite
        open={inviting}
        onOpenChange={setInviting}
        roles={roles.data?.roles ?? []}
        canAssign={hasPermission(me, 'core:roles-assign')}
      />
    </div>
  )
}

function Invite({
  open,
  onOpenChange,
  roles,
  canAssign,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  roles: Role[]
  canAssign: boolean
}) {
  const { t, locale } = useLocale()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const create = useMutation({
    mutationFn: () =>
      api<{ url: string; expiresAt: string }>('/users/invitations', {
        body: { email, roles: role ? [{ roleKey: role }] : [] },
      }),
    onSuccess: setLink,
    onError: (e) =>
      notify(
        t(
          e instanceof ApiError && e.code === 'email_taken'
            ? 'admin.users.err_email_taken'
            : 'admin.common.error',
        ),
        { tone: 'danger' },
      ),
  })
  const close = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setLink(null)
      setEmail('')
      setRole('')
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title={link ? t('admin.users.link_title') : t('admin.users.invite_title')}
    >
      {link ? (
        <div className="grid gap-4">
          <CopyLink
            url={link.url}
            note={t('admin.users.link_text', { date: fmt(link.expiresAt, locale) })}
          />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => close(false)}>
              {t('admin.common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <p className="text-ink-muted">{t('admin.users.invite_text')}</p>
          <TextField
            label={t('admin.users.email')}
            placeholder={t('admin.users.email_ph')}
            type="email"
            required
            value={email}
            onChange={(e: { target: { value: string } }) => setEmail(e.target.value)}
          />
          {canAssign && (
            <SelectField
              label={t('admin.users.invite_role')}
              value={role || '__none'}
              onValueChange={(v) => setRole(v && v !== '__none' ? v : '')}
              options={[
                { value: '__none', label: t('admin.users.invite_role_none') },
                ...roles
                  .filter((r) => r.key !== 'super-admin')
                  .map((r) => ({ value: r.key, label: bi(r.nameFr, r.nameEn, locale) })),
              ]}
            />
          )}
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => close(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t('admin.users.create_link')}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
