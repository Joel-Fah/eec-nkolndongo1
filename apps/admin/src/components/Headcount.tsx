import { useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { useDashboardData } from '../lib/dashboard'
import { AreaChart, ChartTable, Fold } from './Charts'
import { TrendBadge } from './TrendBadge'

const k = (key: string) => `members.dash.${key}` as MessageKey

/** The headcount for the dashboard: three numbers with their trend, a bar per group, a 12-month chart (smooth area with a gradient, and its table). */
export function Headcount() {
  const { t, locale } = useLocale()
  const { members } = useDashboardData()
  if (members.fetchStatus === 'idle' && !members.data) return null
  const s = members.data
  const gname = (g: { nameFr: string; nameEn: string | null }) =>
    locale === 'en' ? (g.nameEn ?? g.nameFr) : g.nameFr
  const cards = s
    ? ([
        ['total', s.total, s.previous.total],
        ['new_month', s.newThisMonth, s.previous.newThisMonth],
        ['news', s.newsSubscribers, s.previous.newsSubscribers],
      ] as const)
    : []
  return (
    <section className="grid gap-4" aria-labelledby="headcount-title">
      <h2 id="headcount-title" className="text-2xl">
        {t(k('title'))}
      </h2>
      {!s ? (
        <span className="skeleton h-40" aria-busy="true" />
      ) : s.total === 0 && s.trend.every((x) => x.n === 0) ? (
        <p className="rounded-lg bg-surface-2 p-6 text-ink-muted">{t(k('empty'))}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {cards.map(([key, n, before]) => (
              <div key={key} className="stat-card">
                <p className="stat-number">{n}</p>
                <p className="text-sm text-ink-muted">{t(k(key))}</p>
                <TrendBadge current={n} previous={before} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="stat-card">
              <h3 className="text-lg">{t(k('trend'))}</h3>
              <AreaChart
                months={s.trend.map((x) => x.month)}
                series={[
                  {
                    key: 'n',
                    label: t(k('new')),
                    values: s.trend.map((x) => x.n),
                    tone: 'primary',
                  },
                ]}
                label={t(k('trend'))}
              />
              <Fold summary={t(k('trend_table'))}>
                <ChartTable
                  months={s.trend.map((x) => x.month)}
                  series={[
                    {
                      key: 'n',
                      label: t(k('new')),
                      values: s.trend.map((x) => x.n),
                      tone: 'primary',
                    },
                  ]}
                  monthHeader={t(k('month'))}
                />
              </Fold>
            </div>
            <div className="stat-card">
              <h3 className="text-lg">{t(k('by_group'))}</h3>
              {s.byGroup.length === 0 && (
                <p className="text-sm text-ink-muted">{t(k('no_groups'))}</p>
              )}
              <ul className="grid gap-2">
                {s.byGroup.map((g) => (
                  <li key={g.key} className="bar-row">
                    <span>{gname(g)}</span>
                    <span className="bar" aria-hidden="true">
                      <span
                        style={{ width: `${s.total ? Math.max(2, (g.n / s.total) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{g.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
