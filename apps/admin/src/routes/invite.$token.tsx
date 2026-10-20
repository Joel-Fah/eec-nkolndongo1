import { api, errorKey, useT } from '@eec/admin-kit'
import { Button, TextField } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { LocaleSwitch, ThemeButton } from '../components/Controls'
import { Mark } from '../components/Mark'

export const Route = createFileRoute('/invite/$token')({ component: Invite })

function Invite() {
  const t = useT()
  const { token } = Route.useParams()
  const check = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<{ email: string }>(`/invitations/${token}`),
    retry: false,
  })
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  return (
    <div className="login">
      <div className="login-tools">
        <LocaleSwitch />
        <ThemeButton />
      </div>
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          setBusy(true)
          setError(undefined)
          try {
            await api(`/invitations/${token}/accept`, {
              body: {
                name: String(data.get('name') ?? ''),
                password: String(data.get('password') ?? ''),
              },
            })
            window.location.assign('/admin/')
          } catch (err) {
            setError(t(errorKey(err)))
            setBusy(false)
          }
        }}
      >
        <Mark variant="mark" className="login-mark" label={t('site.church')} />
        <div className="grid gap-1 text-center">
          <h1 className="text-3xl">{t('auth.invite.title')}</h1>
          <p className="text-ink-muted">{t('auth.invite.lead')}</p>
        </div>
        {check.isPending && (
          <p className="text-center text-ink-muted">{t('auth.invite.checking')}</p>
        )}
        {check.isError && (
          <p className="field-error" role="alert">
            {t(errorKey(check.error))}
          </p>
        )}
        {check.data && (
          <>
            <TextField
              label={t('auth.invite.email')}
              placeholder={t('common.ph.email')}
              name="email"
              type="email"
              value={check.data.email}
              readOnly
            />
            <TextField
              label={t('auth.invite.name')}
              placeholder={t('common.ph.name')}
              name="name"
              autoComplete="name"
              required
            />
            <TextField
              label={t('login.password')}
              placeholder={t('common.ph.new_password')}
              name="password"
              type="password"
              autoComplete="new-password"
              hint={t('auth.password.hint')}
              required
            />
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy}>
              {t('auth.invite.submit')}
            </Button>
          </>
        )}
      </form>
    </div>
  )
}
