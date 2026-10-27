import { api, errorKey, meQuery, useSessionActions, useT } from '@eec/admin-kit'
import { Button } from '@eec/ui/react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from '../components/AuthShell'
import { PasswordField } from '../components/PasswordField'

// A team member who has only ever signed in with Google chooses a password before using the admin (decision 0053): a
// backup way in, and an account that stays safe if their role changes later.
export const Route = createFileRoute('/set-password')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/login' })
    if (!me.needsPassword) throw redirect({ to: '/' })
  },
  component: SetPassword,
})

function SetPassword() {
  const t = useT()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { signOut } = useSessionActions()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  return (
    <AuthShell>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          const next = String(data.get('password') ?? '')
          if (next !== String(data.get('again') ?? '')) {
            setError(t('auth.setpw.mismatch'))
            return
          }
          setBusy(true)
          setError(undefined)
          try {
            await api('/me/password/set', { body: { next } })
            await qc.fetchQuery({ ...meQuery, staleTime: 0 })
            await navigate({ to: '/' })
          } catch (err) {
            setError(t(errorKey(err)))
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid gap-1">
          <h1 className="text-3xl">{t('auth.setpw.title')}</h1>
          <p className="text-ink-muted">{t('auth.setpw.lead')}</p>
        </div>
        <PasswordField
          label={t('login.password')}
          placeholder={t('common.ph.new_password')}
          name="password"
          autoComplete="new-password"
          hint={t('auth.password.hint')}
          required
        />
        <PasswordField
          label={t('auth.setpw.again')}
          placeholder={t('common.ph.new_password')}
          name="again"
          autoComplete="new-password"
          required
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy}>
          {t('auth.setpw.submit')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            await signOut()
            await navigate({ to: '/login' })
          }}
        >
          {t('auth.setpw.later')}
        </Button>
      </form>
    </AuthShell>
  )
}
