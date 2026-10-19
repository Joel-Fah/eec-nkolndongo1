import { Button, SwitchField, TextField, toastManager } from '@eec/ui/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { LocaleSwitch, ThemeButton } from '../components/Controls'
import { Mark } from '../components/Mark'
import { useT } from '../lib/locale'

export const Route = createFileRoute('/login')({ component: Login })

/** UI only — no authentication logic until phase 02. */
function Login() {
  const t = useT()
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  return (
    <div className="login">
      <div className="login-tools">
        <LocaleSwitch />
        <ThemeButton />
      </div>
      <form
        className="login-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          const email = String(data.get('email') ?? '')
          const password = String(data.get('password') ?? '')
          const next = {
            email: /^\S+@\S+\.\S+$/.test(email) ? undefined : t('login.error_email'),
            password: password ? undefined : t('login.error_password'),
          }
          setErrors(next)
          if (!next.email && !next.password)
            toastManager.add({ title: t('login.pending'), data: { tone: 'info' } })
        }}
      >
        <Mark variant="mark" className="login-mark" label={t('site.church')} />
        <div className="grid gap-1 text-center">
          <h1 className="text-3xl">{t('login.title')}</h1>
          <p className="text-ink-muted">{t('login.lead')}</p>
        </div>
        <TextField
          label={t('login.email')}
          name="email"
          type="email"
          autoComplete="email"
          error={errors.email}
        />
        <TextField
          label={t('login.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
        />
        <SwitchField label={t('login.remember')} name="remember" />
        <Button type="submit" size="lg">
          {t('login.submit')}
        </Button>
        <p className="text-center text-sm text-ink-muted">{t('login.pending')}</p>
        <p className="text-center">
          <Link to="/" className="btn btn-link">
            {t('login.back')}
          </Link>
        </p>
      </form>
    </div>
  )
}
