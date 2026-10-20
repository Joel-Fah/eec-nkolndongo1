import { useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { change } from '../lib/dashboard'
import { Icon } from './Icon'

/**
 * « ▲ +12 % vs last month »: green for more, red for fewer, grey when nothing changed. The direction is also
 * written out for screen readers (colour and arrow are never the only signal).
 */
export function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const { t } = useLocale()
  const { direction, percent, diff } = change(current, previous)
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : ''
  const value =
    percent === null
      ? direction === 'flat'
        ? '0'
        : `${sign}${Math.abs(diff)}`
      : `${sign}${percent} %`
  const word = t(`dash.trend_${direction}` as MessageKey)
  return (
    <span className="trend-badge" data-direction={direction}>
      {direction !== 'flat' && (
        <Icon name={direction === 'up' ? 'trendUp' : 'trendDown'} size={16} />
      )}
      <span aria-hidden="true" className="trend-value">
        {value}
      </span>
      <span className="sr-only">
        {word} {percent === null ? Math.abs(diff) : `${percent} %`}
      </span>
      <span className="trend-period">{t('dash.vs_last_month')}</span>
    </span>
  )
}
