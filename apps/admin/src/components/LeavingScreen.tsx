import { useLocale } from '@eec/admin-kit'
import { Brand } from './Brand'

/** Shown the moment someone signs out: the logo breathes, a thin bar fills, a warm goodbye (role=status). */
export function LeavingScreen() {
  const { t } = useLocale()
  return (
    <div className="leaving" role="status" aria-live="polite">
      <div className="leaving-badge">
        <Brand />
      </div>
      <p className="leaving-text">{t('admin.leaving')}</p>
      <span className="leaving-bar" aria-hidden="true">
        <span />
      </span>
    </div>
  )
}
