import { ApiError, api, useLocale, useMe } from '@eec/admin-kit'
import type { Locale, MessageKey } from '@eec/i18n'
import { Badge, Button, SelectField, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { deviceName, fmt, notify, PageHeader } from '../../components/kit'
import { type ThemeChoice, useTheme } from '../../lib/theme'

export const Route = createFileRoute('/_app/account')({ component: Account })

type Session = { id: string; createdAt: string; userAgent: string | null; current: boolean }

/** Mon compte: available to everyone signed in (no permission needed: it's their own data). */
function Account() {
  const { t, locale, setLocale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const theme = useTheme()
  const [form, setForm] = useState({ firstName: '', lastName: '', name: '', phone: '' })
  useEffect(() => {
    if (me)
      setForm({
        firstName: me.user.firstName,
        lastName: me.user.lastName,
        name: me.user.name,
        phone: me.user.phone ?? '',
      })
  }, [me])
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/me', { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      notify(t('admin.common.saved'))
    },
    onError: () => notify(t('admin.common.error'), { tone: 'danger' }),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({ ...form, phone: form.phone || null })
  }
  const field = (key: keyof typeof form, label: MessageKey, ph: MessageKey) => (
    <TextField
      label={t(label)}
      placeholder={t(ph)}
      value={form[key]}
      onChange={(e: { target: { value: string } }) =>
        setForm((f) => ({ ...f, [key]: e.target.value }))
      }
    />
  )

  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader title={t('admin.account.title')} lead={t('admin.account.lead')} />
      <form className="admin-panel" onSubmit={submit}>
        <h2 className="text-xl">{t('admin.account.profile')}</h2>
        <p className="text-sm text-ink-muted">{me?.user.email}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('firstName', 'admin.users.first_name', 'common.ph.first_name')}
          {field('lastName', 'admin.users.last_name', 'common.ph.last_name')}
          {field('name', 'admin.users.display_name', 'common.ph.name')}
          {field('phone', 'admin.users.phone', 'common.ph.phone')}
        </div>
        <div>
          <Button type="submit" loading={save.isPending}>
            {t('admin.common.save')}
          </Button>
        </div>
      </form>

      <section className="admin-panel">
        <h2 className="text-xl">{t('admin.account.prefs')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t('admin.users.language')}
            value={locale}
            onValueChange={(v) => {
              if (!v) return
              setLocale(v as Locale)
              save.mutate({ locale: v })
            }}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
          />
          <SelectField
            label={t('admin.account.theme')}
            value={theme.choice}
            onValueChange={(v) => {
              if (!v) return
              theme.set(v as ThemeChoice)
              save.mutate({ theme: v })
            }}
            options={(['system', 'light', 'dark'] as const).map((c) => ({
              value: c,
              label: t(`admin.account.themes.${c}`),
            }))}
          />
        </div>
      </section>

      <Password />
      <Sessions />
    </div>
  )
}

function Password() {
  const { t } = useLocale()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const change = useMutation({
    mutationFn: () => api('/me/password', { body: { current, next } }),
    onSuccess: () => {
      setCurrent('')
      setNext('')
      notify(t('admin.account.changed'))
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : ''
      notify(
        t(
          code === 'invalid_credentials'
            ? 'admin.account.err_current'
            : code.startsWith('password_')
              ? (`auth.err.${code}` as MessageKey)
              : 'admin.common.error',
        ),
        { tone: 'danger' },
      )
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    change.mutate()
  }
  return (
    <form className="admin-panel" onSubmit={submit}>
      <h2 className="text-xl">{t('admin.account.password')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('admin.account.current')}
          placeholder={t('admin.account.current_ph')}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e: { target: { value: string } }) => setCurrent(e.target.value)}
        />
        <TextField
          label={t('admin.account.new')}
          placeholder={t('common.ph.new_password')}
          hint={t('auth.password.hint')}
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e: { target: { value: string } }) => setNext(e.target.value)}
        />
      </div>
      <div>
        <Button type="submit" loading={change.isPending}>
          {t('admin.account.change')}
        </Button>
      </div>
    </form>
  )
}

function Sessions() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => api<{ sessions: Session[] }>('/me/sessions'),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-sessions'] })
  const others = (list.data?.sessions ?? []).filter((s) => !s.current)
  return (
    <section className="admin-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl">{t('admin.account.sessions')}</h2>
        {others.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              api<{ closed: number }>('/me/sessions', { method: 'DELETE' })
                .then((r) => {
                  refresh()
                  notify(t('admin.account.signed_out_others', { n: String(r.closed) }))
                })
                .catch(() => notify(t('admin.common.error'), { tone: 'danger' }))
            }
          >
            {t('admin.account.signout_others')}
          </Button>
        )}
      </div>
      <ul className="grid gap-2">
        {(list.data?.sessions ?? []).map((s) => (
          <li key={s.id} className="admin-row">
            <span className="grid">
              <span className="flex flex-wrap items-center gap-2">
                {deviceName(s.userAgent) ?? t('admin.account.unknown_device')}
                {s.current && <Badge tone="success">{t('admin.account.this_device')}</Badge>}
              </span>
              <span className="text-sm text-ink-muted">
                {t('admin.account.started', { date: fmt(s.createdAt, locale) })}
              </span>
            </span>
            {!s.current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  api(`/me/sessions/${s.id}`, { method: 'DELETE' })
                    .then(() => {
                      refresh()
                      notify(t('admin.account.closed'))
                    })
                    .catch(() => notify(t('admin.common.error'), { tone: 'danger' }))
                }
              >
                {t('admin.account.close_session')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
