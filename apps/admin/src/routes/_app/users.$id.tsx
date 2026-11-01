import { ApiError, api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Avatar, Badge, Button, SelectField, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Confirm, CopyLink, deviceName, fmt, Gate, notify, Sheet } from '../../components/kit'
import { bi, type Grant, type Group, type Role } from '../../lib/types'
import { initials } from './users.index'

export const Route = createFileRoute('/_app/users/$id')({
  component: () => (
    <Gate permission="core:users-read">
      <Person />
    </Gate>
  ),
})

type Detail = {
  user: {
    id: string
    email: string
    name: string
    firstName: string
    lastName: string
    phone: string | null
    locale: 'fr' | 'en'
    status: 'active' | 'invited' | 'deactivated'
    lastSeenAt: string | null
    createdAt: string
  }
  roles: Grant[]
  groups: { groupId: string; nameFr: string; nameEn: string | null; titleFr: string | null }[]
  sessions: { id: string; createdAt: string; expiresAt: string; userAgent: string | null }[]
  /** How the person signs in: Google, e-mail and password, or both. */
  signIn: ('google' | 'email')[]
  activity: {
    id: string
    action: string
    summaryFr: string
    summaryEn: string | null
    createdAt: string
  }[]
}

const errKey = (e: unknown): MessageKey => {
  const code = e instanceof ApiError ? e.code : ''
  if (code === 'last_super_admin') return 'admin.users.err_last_super_admin'
  if (code === 'self') return 'admin.users.err_self'
  if (code === 'already_granted') return 'admin.users.err_already'
  return 'admin.common.error'
}

function Person() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const detail = useQuery({ queryKey: ['user', id], queryFn: () => api<Detail>(`/users/${id}`) })
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ roles: Role[] }>('/roles'),
    enabled: hasPermission(me, 'core:roles-read'),
  })
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => api<{ groups: Group[] }>('/groups'),
    enabled: hasPermission(me, 'core:groups-read'),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['user', id] })
    qc.invalidateQueries({ queryKey: ['users'] })
  }
  const run = (fn: () => Promise<unknown>, ok: MessageKey, undo?: () => Promise<unknown>) =>
    fn()
      .then(() => {
        refresh()
        notify(
          t(ok),
          undo ? { undo: { label: t('admin.common.undo'), run: () => undo().then(refresh) } } : {},
        )
      })
      .catch((e) => notify(t(errKey(e)), { tone: 'danger' }))

  const [confirmOff, setConfirmOff] = useState(false)
  const [confirmGoogle, setConfirmGoogle] = useState(false)
  const [reset, setReset] = useState<{ url: string; expiresAt: string } | null>(null)
  const makeReset = useMutation({
    mutationFn: () =>
      api<{ url: string; expiresAt: string }>(`/users/${id}/reset-link`, { body: {} }),
    onSuccess: setReset,
    onError: () => notify(t('admin.common.error'), { tone: 'danger' }),
  })

  const d = detail.data
  if (!d) return <span className="skeleton h-64" aria-busy="true" />
  const u = d.user
  const isSelf = me?.user.id === u.id

  return (
    <div className="grid gap-8">
      <Link to="/users" className="btn btn-ghost btn-sm w-fit">
        <Icon name="arrowLeft" size={16} />
        {t('admin.items.users')}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar initials={initials(u.name)} />
          <div className="grid gap-1">
            <h1 className="text-3xl">{u.name}</h1>
            <p className="text-ink-muted">
              {u.email} · {t('admin.common.since', { date: fmt(u.createdAt, locale) })}
            </p>
          </div>
          <Badge
            tone={u.status === 'active' ? 'success' : u.status === 'invited' ? 'info' : 'warning'}
          >
            {t(`admin.status.${u.status}` as MessageKey)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(me, 'core:users-reset-link') && (
            <Button
              variant="secondary"
              loading={makeReset.isPending}
              onClick={() => makeReset.mutate()}
            >
              {t('admin.users.reset')}
            </Button>
          )}
          {hasPermission(me, 'core:users-deactivate') &&
            !isSelf &&
            (u.status === 'deactivated' ? (
              <Button
                variant="secondary"
                onClick={() =>
                  run(() => api(`/users/${id}/reactivate`, { body: {} }), 'admin.users.reactivated')
                }
              >
                {t('admin.users.reactivate')}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmOff(true)}>
                {t('admin.users.deactivate')}
              </Button>
            ))}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <Profile detail={d} canEdit={hasPermission(me, 'core:users-update')} onSaved={refresh} />
        <Roles
          detail={d}
          roles={roles.data?.roles ?? []}
          groups={groups.data?.groups ?? []}
          canAssign={hasPermission(me, 'core:roles-assign')}
          run={run}
        />
        <Memberships
          detail={d}
          groups={groups.data?.groups ?? []}
          canManage={hasPermission(me, 'core:groups-manage')}
          run={run}
        />
        <section className="admin-panel">
          <h2 className="text-xl">{t('admin.users.sign_in')}</h2>
          <div className="flex flex-wrap gap-2">
            {d.signIn.map((x) => (
              <Badge key={x} tone={x === 'google' ? 'info' : 'primary'}>
                {t(`admin.account.sign_${x}` as MessageKey)}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-ink-muted">
            {d.signIn.includes('google') && !d.signIn.includes('email')
              ? t('admin.users.google_only')
              : d.signIn.includes('google')
                ? t('admin.users.google_both')
                : t('admin.users.google_none')}
          </p>
          {hasPermission(me, 'core:users-deactivate') && !isSelf && d.signIn.includes('google') && (
            <div>
              <Button variant="secondary" size="sm" onClick={() => setConfirmGoogle(true)}>
                {t('admin.users.google_remove')}
              </Button>
            </div>
          )}
        </section>
        <section className="admin-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl">{t('admin.users.sessions')}</h2>
            {hasPermission(me, 'core:users-deactivate') && d.sessions.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  api<{ closed: number }>(`/users/${id}/sessions`, { method: 'DELETE' })
                    .then((r) => {
                      refresh()
                      notify(t('admin.users.revoked_all', { n: String(r.closed) }))
                    })
                    .catch(() => notify(t('admin.common.error'), { tone: 'danger' }))
                }
              >
                {t('admin.users.revoke_all')}
              </Button>
            )}
          </div>
          {d.sessions.length ? (
            <ul className="grid gap-2">
              {d.sessions.map((s) => (
                <li key={s.id} className="admin-row">
                  <span>{deviceName(s.userAgent) ?? t('admin.account.unknown_device')}</span>
                  <span className="text-sm text-ink-muted">
                    {t('admin.account.started', { date: fmt(s.createdAt, locale) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t('admin.users.sessions_none')}</p>
          )}
        </section>
        <section className="admin-panel xl:col-span-2">
          <h2 className="text-xl">{t('admin.users.activity')}</h2>
          {d.activity.length ? (
            <ol className="grid gap-2">
              {d.activity.map((a) => (
                <li key={a.id} className="admin-row">
                  <span>{locale === 'en' ? (a.summaryEn ?? a.summaryFr) : a.summaryFr}</span>
                  <span className="text-sm text-ink-muted">{fmt(a.createdAt, locale)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-muted">{t('admin.users.activity_none')}</p>
          )}
        </section>
      </div>

      <Confirm
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={t('admin.users.deactivate')}
        text={t('admin.users.deactivate_text')}
        confirmLabel={t('admin.users.deactivate')}
        danger
        onConfirm={() => {
          setConfirmOff(false)
          run(
            () => api(`/users/${id}/deactivate`, { body: {} }),
            'admin.users.deactivated',
            () => api(`/users/${id}/reactivate`, { body: {} }),
          )
        }}
      />
      <Confirm
        open={confirmGoogle}
        onOpenChange={setConfirmGoogle}
        title={t('admin.users.google_remove')}
        text={t('admin.users.google_remove_text', { name: u.name })}
        confirmLabel={t('admin.users.google_remove')}
        danger
        onConfirm={() => {
          setConfirmGoogle(false)
          run(() => api(`/users/${id}/google`, { method: 'DELETE' }), 'admin.users.google_removed')
        }}
      />
      <Sheet
        open={!!reset}
        onOpenChange={(o) => !o && setReset(null)}
        title={t('admin.users.reset_title')}
      >
        {reset && (
          <div className="grid gap-4">
            <CopyLink url={reset.url} note={t('admin.users.reset_text')} />
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setReset(null)}>
                {t('admin.common.close')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Profile({
  detail,
  canEdit,
  onSaved,
}: {
  detail: Detail
  canEdit: boolean
  onSaved: () => void
}) {
  const { t } = useLocale()
  const u = detail.user
  const [form, setForm] = useState({
    firstName: u.firstName,
    lastName: u.lastName,
    name: u.name,
    phone: u.phone ?? '',
    locale: u.locale,
  })
  useEffect(
    () =>
      setForm({
        firstName: u.firstName,
        lastName: u.lastName,
        name: u.name,
        phone: u.phone ?? '',
        locale: u.locale,
      }),
    [u],
  )
  const save = useMutation({
    mutationFn: () =>
      api(`/users/${u.id}`, { method: 'PATCH', body: { ...form, phone: form.phone || null } }),
    onSuccess: () => {
      onSaved()
      notify(t('admin.common.saved'))
    },
    onError: () => notify(t('admin.common.error'), { tone: 'danger' }),
  })
  const field = (
    key: 'firstName' | 'lastName' | 'name' | 'phone',
    label: MessageKey,
    ph: MessageKey,
  ) => (
    <TextField
      label={t(label)}
      placeholder={t(ph)}
      value={form[key]}
      readOnly={!canEdit}
      onChange={(e: { target: { value: string } }) =>
        setForm((f) => ({ ...f, [key]: e.target.value }))
      }
    />
  )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  return (
    <form className="admin-panel" onSubmit={submit}>
      <h2 className="text-xl">{t('admin.users.profile')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('firstName', 'admin.users.first_name', 'common.ph.first_name')}
        {field('lastName', 'admin.users.last_name', 'common.ph.last_name')}
        {field('name', 'admin.users.display_name', 'common.ph.name')}
        {field('phone', 'admin.users.phone', 'common.ph.phone')}
        <SelectField
          label={t('admin.users.language')}
          value={form.locale}
          onValueChange={(v) => v && setForm((f) => ({ ...f, locale: v as 'fr' | 'en' }))}
          options={[
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      {canEdit && (
        <div>
          <Button type="submit" loading={save.isPending}>
            {t('admin.common.save')}
          </Button>
        </div>
      )}
    </form>
  )
}

type Run = (
  fn: () => Promise<unknown>,
  ok: MessageKey,
  undo?: () => Promise<unknown>,
) => Promise<unknown>

function Roles({
  detail,
  roles,
  groups,
  canAssign,
  run,
}: {
  detail: Detail
  roles: Role[]
  groups: Group[]
  canAssign: boolean
  run: Run
}) {
  const { t, locale } = useLocale()
  const id = detail.user.id
  const [role, setRole] = useState('')
  const [scope, setScope] = useState('')
  return (
    <section className="admin-panel">
      <h2 className="text-xl">{t('admin.users.roles')}</h2>
      <p className="text-sm text-ink-muted">{t('admin.users.roles_help')}</p>
      {canAssign && detail.signIn.includes('google') && !detail.signIn.includes('email') && (
        <p className="text-sm text-ink-muted">{t('admin.users.roles_google_note')}</p>
      )}
      <ul className="grid gap-2">
        {detail.roles.map((g) => (
          <li key={g.id} className="admin-row">
            <span>
              <span className="font-medium">{bi(g.roleFr, g.roleEn, locale)}</span>
              <span className="text-sm text-ink-muted">
                {' '}
                · {g.groupId ? bi(g.groupFr, g.groupEn, locale) : t('admin.users.scope_all')}
              </span>
            </span>
            {canAssign && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  run(
                    () => api(`/users/${id}/roles/${g.id}`, { method: 'DELETE' }),
                    'admin.users.role_removed',
                    () =>
                      api(`/users/${id}/roles`, {
                        body: { roleKey: g.roleKey, groupId: g.groupId },
                      }),
                  )
                }
              >
                {t('admin.common.remove')}
              </Button>
            )}
          </li>
        ))}
        {detail.roles.length === 0 && (
          <li className="text-ink-muted">{t('admin.users.no_roles')}</li>
        )}
      </ul>
      {canAssign && roles.length > 0 && (
        <div className="admin-inline-form">
          <SelectField
            label={t('admin.users.role')}
            placeholder={t('admin.users.add_role')}
            value={role || undefined}
            onValueChange={(v) => setRole(v ?? '')}
            options={roles.map((r) => ({ value: r.key, label: bi(r.nameFr, r.nameEn, locale) }))}
          />
          <SelectField
            label={t('admin.users.scope')}
            value={scope || '__all'}
            onValueChange={(v) => setScope(v && v !== '__all' ? v : '')}
            options={[
              { value: '__all', label: t('admin.users.scope_all') },
              ...groups
                .filter((g) => g.isActive)
                .map((g) => ({ value: g.id, label: bi(g.nameFr, g.nameEn, locale) })),
            ]}
          />
          <Button
            variant="secondary"
            disabled={!role}
            onClick={() =>
              run(
                () =>
                  api(`/users/${id}/roles`, { body: { roleKey: role, groupId: scope || null } }),
                'admin.users.role_added',
              ).then(() => {
                setRole('')
                setScope('')
              })
            }
          >
            {t('admin.users.add_role')}
          </Button>
        </div>
      )}
    </section>
  )
}

function Memberships({
  detail,
  groups,
  canManage,
  run,
}: {
  detail: Detail
  groups: Group[]
  canManage: boolean
  run: Run
}) {
  const { t, locale } = useLocale()
  const id = detail.user.id
  const [group, setGroup] = useState('')
  const [title, setTitle] = useState('')
  return (
    <section className="admin-panel">
      <h2 className="text-xl">{t('admin.users.groups')}</h2>
      <p className="text-sm text-ink-muted">{t('admin.users.groups_help')}</p>
      <ul className="grid gap-2">
        {detail.groups.map((g) => (
          <li key={g.groupId} className="admin-row">
            <span>
              <span className="font-medium">{bi(g.nameFr, g.nameEn, locale)}</span>
              {g.titleFr && <span className="text-sm text-ink-muted"> · {g.titleFr}</span>}
            </span>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  run(
                    () => api(`/users/${id}/groups/${g.groupId}`, { method: 'DELETE' }),
                    'admin.users.group_removed',
                    () =>
                      api(`/users/${id}/groups`, {
                        body: { groupId: g.groupId, titleFr: g.titleFr ?? undefined },
                      }),
                  )
                }
              >
                {t('admin.common.remove')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canManage && groups.length > 0 && (
        <div className="admin-inline-form">
          <SelectField
            label={t('admin.users.group')}
            placeholder={t('admin.users.add_group')}
            value={group || undefined}
            onValueChange={(v) => setGroup(v ?? '')}
            options={groups
              .filter((g) => g.isActive)
              .map((g) => ({ value: g.id, label: bi(g.nameFr, g.nameEn, locale) }))}
          />
          <TextField
            label={`${t('admin.users.title_in_group')} (${t('admin.common.optional')})`}
            placeholder={t('admin.users.title_ph')}
            value={title}
            onChange={(e: { target: { value: string } }) => setTitle(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!group}
            onClick={() =>
              run(
                () =>
                  api(`/users/${id}/groups`, {
                    body: { groupId: group, titleFr: title || undefined },
                  }),
                'admin.users.group_added',
              ).then(() => {
                setGroup('')
                setTitle('')
              })
            }
          >
            {t('admin.users.add_group')}
          </Button>
        </div>
      )}
    </section>
  )
}
