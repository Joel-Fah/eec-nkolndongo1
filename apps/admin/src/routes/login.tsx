import { errorKey, meQuery, useSessionActions, useT } from '@eec/admin-kit'
import { Button, TextField } from '@eec/ui/react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from '../components/AuthShell'

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
    <AuthShell>
      <form
        className="auth-form"
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
        <div className="grid gap-1">
          <h1 className="text-3xl">{t('auth.login.title')}</h1>
          <p className="text-ink-muted">{t('auth.login.lead')}</p>
        </div>
        <TextField
          label={t('login.email')}
          placeholder={t('common.ph.email')}
          name="email"
          type="email"
          autoComplete="username"
          required
        />
        <TextField
          label={t('login.password')}
          placeholder={t('common.ph.password')}
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
        <p className="text-sm text-ink-muted">{t('auth.login.hint')}</p>
      </form>
    </AuthShell>
  )
}
