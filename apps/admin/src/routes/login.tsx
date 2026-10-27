import {
  ApiError,
  api,
  errorKey,
  meQuery,
  useLocale,
  useSessionActions,
  useT,
} from '@eec/admin-kit'
import googleG from '@eec/ui/brand/google-g.svg?raw'
import { Button, TextField } from '@eec/ui/react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AuthShell } from '../components/AuthShell'
import { PasswordField } from '../components/PasswordField'

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
  const { locale } = useLocale()
  const [waiting, setWaiting] = useState(false)

  // Coming back from Google without being let in: say why, then clean the address.
  useEffect(() => {
    const back = new URLSearchParams(window.location.search).get('google')
    if (!back) return
    setError(
      t(
        back === 'staff'
          ? 'auth.login.google_staff'
          : back === 'notstaff'
            ? 'auth.login.google_notstaff'
            : 'auth.login.google_error',
      ),
    )
    window.history.replaceState(null, '', window.location.pathname)
  }, [t])

  // Staff who linked Google from « Mon compte » come back in with it (decision 0053); nobody is created here.
  const google = async () => {
    setWaiting(true)
    setError(undefined)
    try {
      const r = await api<{ url: string }>('/members/google', { body: { locale, target: 'admin' } })
      window.location.assign(r.url)
    } catch (err) {
      setWaiting(false)
      setError(
        t(
          err instanceof ApiError && err.code === 'not_configured'
            ? 'auth.login.google_off'
            : 'auth.login.google_error',
        ),
      )
    }
  }
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
        <PasswordField
          label={t('login.password')}
          placeholder={t('common.ph.password')}
          name="password"
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
        <Button type="button" variant="secondary" size="lg" loading={waiting} onClick={google}>
          <span
            className="grid size-5 place-items-center"
            aria-hidden="true"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: our own brand drawing
            dangerouslySetInnerHTML={{ __html: googleG }}
          />
          {t('auth.login.google')}
        </Button>
        <p className="text-sm text-ink-muted">{t('auth.login.hint')}</p>
      </form>
    </AuthShell>
  )
}
