import { useLocale } from '@eec/admin-kit'
import { Mark } from './Mark'

/**
 * The logomark always travels with the parish name (the mark belongs to the whole family of churches, so
 * it never appears alone). Two lines, like the site's header lockup.
 */
export function Brand({ className }: { className?: string }) {
  const { t } = useLocale()
  return (
    <span className={`brand-lockup ${className ?? ''}`}>
      <Mark className="brand-lockup-mark" />
      <span className="brand-lockup-text">
        <span className="brand-lockup-church">{t('lockup.long_church')}</span>
        <span className="brand-lockup-name">{t('lockup.long_parish')}</span>
      </span>
    </span>
  )
}
