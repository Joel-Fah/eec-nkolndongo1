import { useLocale } from '@eec/admin-kit'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Icon } from './Icon'

/**
 * Proof that a click was heard. A thin themed bar runs under the top bar while the next screen loads (shown after
 * 100 ms, so quick moves do not flicker), and the work area is marked busy for assistive technology.
 */
export function NavProgress() {
  const { t } = useLocale()
  const loading = useRouterState({ select: (s) => s.isLoading || s.status === 'pending' })
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!loading) {
      setShown(false)
      return
    }
    const id = setTimeout(() => setShown(true), 100)
    return () => clearTimeout(id)
  }, [loading])
  return (
    <div
      className="nav-progress"
      data-active={shown ? '' : undefined}
      role="progressbar"
      aria-hidden={!shown}
      aria-label={t('admin.loading')}
    >
      <span />
    </div>
  )
}

/** The wait inside the work area (lazy screens): a small spinner and a few quiet lines, in our colours. */
export function PageLoading() {
  const { t } = useLocale()
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-spin">
        <Icon name="loading" size={24} />
      </span>
      <span>{t('admin.loading')}</span>
      <span className="skeleton page-loading-line" aria-hidden="true" />
      <span className="skeleton page-loading-line short" aria-hidden="true" />
    </div>
  )
}
