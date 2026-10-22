import { useLocale } from '@eec/admin-kit'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Mark } from './Mark'

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

/**
 * The wait inside the work area (lazy screens), centred: the mark, wrapped in a turning ring that draws and erases
 * itself, a short sentence, and three dots that rise in turn. Shapes and colours come from tokens.
 */
export function PageLoading() {
  const { t } = useLocale()
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="page-loading-orb">
        <svg className="page-loading-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="page-loading-track" cx="50" cy="50" r="44" />
          <circle className="page-loading-arc" cx="50" cy="50" r="44" pathLength="100" />
        </svg>
        <Mark className="page-loading-mark" />
      </div>
      <p className="page-loading-text">
        {t('admin.loading')}
        <span className="page-loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
    </div>
  )
}
