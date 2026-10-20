import { api, errorKey, useT } from '@eec/admin-kit'
import { Button, TextField } from '@eec/ui/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from '../components/AuthShell'

export const Route = createFileRoute('/reset/$token')({ component: Reset })

function Reset() {
  const t = useT()
  const { token } = Route.useParams()
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)
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
            await api(`/reset/${token}`, { body: { password: String(data.get('password') ?? '') } })
            setDone(true)
          } catch (err) {
            setError(t(errorKey(err)))
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid gap-1">
          <h1 className="text-3xl">{t('auth.reset.title')}</h1>
          <p className="text-ink-muted">{done ? t('auth.reset.done') : t('auth.reset.lead')}</p>
        </div>
        {done ? (
          <Link to="/login" className="btn btn-primary btn-lg">
            {t('login.submit')}
          </Link>
        ) : (
          <>
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
              {t('auth.reset.submit')}
            </Button>
          </>
        )}
      </form>
    </AuthShell>
  )
}
