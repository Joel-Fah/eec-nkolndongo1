import { useLocale } from '@eec/admin-kit'
import { callName } from '@eec/core'
import { Link } from '@tanstack/react-router'
import { useDashboardData, useInsights } from '../lib/dashboard'
import { Icon } from './Icon'
import { Illustration } from './Illustration'

/**
 * The welcome banner: a greeting, a short line, a corner illustration (the magic tree in light, the willow in
 * dark, in their own colours) and a few insight cards: advice drawn from what is going on, each with the action
 * to take. They are stacked a little and fan out progressively from left to right; hover or focus spreads them
 * and lifts the one under the pointer.
 */
export function WelcomeBanner() {
  const { t, locale } = useLocale()
  const { me } = useDashboardData()
  const insights = useInsights()
  const long = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  const today = long.charAt(0).toUpperCase() + long.slice(1)
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcome-art">
        <Illustration name="magic-tree" dark="sauce-tree" />
      </div>
      <div className="welcome-copy">
        <p className="welcome-date">{today}</p>
        <h1 id="welcome-title" className="text-4xl">
          {me && callName(me.user)
            ? t('common.greeting', { name: callName(me.user) })
            : t('admin.dashboard')}
        </h1>
        <p className="max-w-[46ch] text-lg text-ink-muted">{t('admin.dashboard_text')}</p>
      </div>
      {insights.length > 0 && (
        <ul
          className="insight-stack"
          aria-label={t('dash.insights')}
          style={{ '--n': insights.length } as React.CSSProperties}
        >
          {insights.map((c, i) => (
            <li key={c.key} className="insight" style={{ '--i': i } as React.CSSProperties}>
              <span className="insight-icon" aria-hidden="true">
                <Icon name={c.icon} size={20} />
              </span>
              <p className="insight-text">
                {t(c.text as never, { n: String(c.n ?? '') } as never)}
              </p>
              <Link to={c.to} params={c.params as never} className="insight-action">
                {t(c.action as never, {} as never)}
                <Icon name="arrowRight" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
