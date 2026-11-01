import { ApiError, api, useLocale, useMe } from '@eec/admin-kit'
import type { Locale, MessageKey } from '@eec/i18n'
import { avatarSvg } from '@eec/ui/avatar-art'
import googleG from '@eec/ui/brand/google-g.svg?raw'
import { Badge, Button, SelectField, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { Confirm, deviceName, fmt, notify, PageHeader } from '../../components/kit'
import { PasswordField } from '../../components/PasswordField'
import { ProfilePanel, useMyProfile } from '../../components/ProfilePanel'
import { roleLabels } from '../../lib/roles'
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

  const mine = useMyProfile().data
  const signIn = mine?.signIn ?? []

  return (
    <div className="grid gap-8">
      <PageHeader title={t('admin.account.title')} lead={t('admin.account.lead')} />
      <div className="acct-grid">
        <div className="acct-col">
          <form className="admin-panel" onSubmit={submit}>
            <h2 className="text-xl">{t('admin.account.profile')}</h2>
            <div className="acct-form-grid">
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

          <ProfilePanel />
          <Password hasPassword={signIn.length === 0 || signIn.includes('email')} />
          <GoogleLink
            linked={signIn.includes('google')}
            hasPassword={signIn.includes('email')}
            enabled={mine?.googleEnabled ?? false}
          />
        </div>

        <aside className="acct-col acct-aside" aria-label={t('admin.account.title')}>
          <div className="acct-id">
            <span className="acct-id-photo" aria-hidden="true">
              {mine?.photo.asAvatar && mine.photo.url ? (
                <img src={mine.photo.url} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: our own drawing, built from a number
                  dangerouslySetInnerHTML={{ __html: avatarSvg(mine?.seed ?? 0) }}
                />
              )}
            </span>
            <div className="grid gap-1">
              <p className="font-display text-2xl">{me?.user.name}</p>
              <p className="text-ink-muted">{me?.user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {signIn.map((x) => (
                <Badge key={x} tone={x === 'google' ? 'info' : 'primary'}>
                  {t(`admin.account.sign_${x}` as MessageKey)}
                </Badge>
              ))}
              {roleLabels(me, locale)
                .slice(0, 3)
                .map((r) => (
                  <Badge key={r.key} tone="gold">
                    {r.label}
                  </Badge>
                ))}
            </div>
          </div>

          <section className="admin-panel">
            <h2 className="text-xl">{t('admin.account.prefs')}</h2>
            <div className="grid gap-4">
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

          <Sessions />
        </aside>
      </div>
    </div>
  )
}

function Password({ hasPassword }: { hasPassword: boolean }) {
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
  if (!hasPassword)
    return (
      <section className="admin-panel">
        <h2 className="text-xl">{t('admin.account.password')}</h2>
        <p className="text-ink-muted">{t('admin.account.google_only')}</p>
      </section>
    )
  return (
    <form className="admin-panel" onSubmit={submit}>
      <h2 className="text-xl">{t('admin.account.password')}</h2>
      <div className="acct-form-grid">
        <PasswordField
          label={t('admin.account.current')}
          placeholder={t('admin.account.current_ph')}
          autoComplete="current-password"
          required
          value={current}
          onChange={(e: { target: { value: string } }) => setCurrent(e.target.value)}
        />
        <PasswordField
          label={t('admin.account.new')}
          placeholder={t('common.ph.new_password')}
          autoComplete="new-password"
          required
          value={next}
          onChange={(e: { target: { value: string } }) => setNext(e.target.value)}
        />
      </div>
      <p className="text-sm text-ink-muted">{t('auth.password.hint')}</p>
      <div>
        <Button type="submit" loading={change.isPending}>
          {t('admin.account.change')}
        </Button>
      </div>
    </form>
  )
}

/**
 * « Connexion avec Google » (decision 0053): add Google to this account from here, signed in. The password is asked again
 * (a stolen session cannot add someone else's Google), the Google address may differ from this account's, and Google can
 * be removed again unless it is the only way in.
 */
function GoogleLink({
  linked,
  hasPassword,
  enabled,
}: {
  linked: boolean
  hasPassword: boolean
  enabled: boolean
}) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState(false)

  // Coming back from Google: say how it went once, then clean the address.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const back = params.get('google')
    if (!back) return
    const why = params.get('error') ?? ''
    notify(
      back === 'linked'
        ? t('admin.account.google_ok')
        : t(
            /different_user|already/.test(why)
              ? 'admin.account.google_taken'
              : 'admin.account.google_fail',
          ),
      { tone: back === 'linked' ? undefined : 'danger' },
    )
    qc.invalidateQueries({ queryKey: ['my-profile'] })
    window.history.replaceState(null, '', window.location.pathname)
  }, [qc, t])

  const start = async () => {
    setBusy(true)
    try {
      const r = await api<{ url: string }>('/me/google', { body: { current } })
      window.location.assign(r.url)
    } catch (e) {
      setBusy(false)
      const code = e instanceof ApiError ? e.code : ''
      notify(
        t(
          code === 'invalid_credentials'
            ? 'admin.account.err_current'
            : code === 'rate_limited'
              ? 'admin.account.google_rate'
              : 'admin.account.google_fail',
        ),
        { tone: 'danger' },
      )
    }
  }
  const remove = useMutation({
    mutationFn: () => api('/me/google', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      notify(t('admin.account.google_removed'))
    },
    onError: () => notify(t('admin.common.error'), { tone: 'danger' }),
  })

  return (
    <section className="admin-panel">
      <h2 className="text-xl">{t('admin.account.google_title')}</h2>
      {linked ? (
        <>
          <p className="text-ink-muted">
            {hasPassword ? t('admin.account.google_linked') : t('admin.account.google_linked_only')}
          </p>
          {hasPassword && (
            <div>
              <Button variant="secondary" onClick={() => setAsk(true)}>
                {t('admin.account.google_remove')}
              </Button>
            </div>
          )}
          <Confirm
            open={ask}
            onOpenChange={setAsk}
            title={t('admin.account.google_remove')}
            text={t('admin.account.google_remove_text')}
            confirmLabel={t('admin.account.google_remove')}
            danger
            busy={remove.isPending}
            onConfirm={() => {
              setAsk(false)
              remove.mutate()
            }}
          />
        </>
      ) : !enabled ? (
        <p className="text-ink-muted">{t('admin.account.google_off')}</p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void start()
          }}
        >
          <p className="text-ink-muted">{t('admin.account.google_lead')}</p>
          {hasPassword && (
            <PasswordField
              label={t('admin.account.google_confirm')}
              placeholder={t('admin.account.current_ph')}
              autoComplete="current-password"
              required
              value={current}
              onChange={(e: { target: { value: string } }) => setCurrent(e.target.value)}
            />
          )}
          <div>
            <Button type="submit" variant="secondary" loading={busy}>
              <span
                className="grid size-5 place-items-center"
                aria-hidden="true"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: our own brand drawing
                dangerouslySetInnerHTML={{ __html: googleG }}
              />
              {t('admin.account.google_link')}
            </Button>
          </div>
          <p className="text-sm text-ink-muted">{t('admin.account.google_other_email')}</p>
        </form>
      )}
    </section>
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
