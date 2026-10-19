import { Button, TextField } from '@eec/ui/react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { LocaleSwitch, ThemeButton } from '../components/Controls'
import { Mark } from '../components/Mark'
import { errorKey } from '../lib/api'
import { useT } from '../lib/locale'
import { meQuery, useSessionActions } from '../lib/session'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(meQuery)) throw redirect({ to: '/' })
  },
  component: Login,
})

function Login() {
  const t = useT()
  const navigate = useNavigate()
  const { signIn } = useSessionActions()
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
            await signIn(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''))
            await navigate({ to: '/' })
          } catch (err) {
            setError(t(errorKey(err)))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Mark variant="mark" className="login-mark" label={t('site.church')} />
        <div className="grid gap-1 text-center">
          <h1 className="text-3xl">{t('auth.login.title')}</h1>
          <p className="text-ink-muted">{t('auth.login.lead')}</p>
        </div>
        <TextField
          label={t('login.email')}
          name="email"
          type="email"
          autoComplete="username"
          required
        />
        <TextField
          label={t('login.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy}>
          {t('login.submit')}
        </Button>
        <p className="text-center text-sm text-ink-muted">{t('auth.login.hint')}</p>
      </form>
    </div>
  )
}
