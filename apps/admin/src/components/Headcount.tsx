import { useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { useDashboardData } from '../lib/dashboard'
import { TrendBadge } from './TrendBadge'

const k = (key: string) => `members.dash.${key}` as MessageKey

/** The headcount for the dashboard: three numbers with their trend, a bar per group, a 12-month chart (SVG + a table). */
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
              <Trend data={s.trend} label={t(k('trend'))} />
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-muted">{t(k('trend_table'))}</summary>
                <table className="admin-table mt-2">
                  <thead>
                    <tr>
                      <th scope="col">{t(k('month'))}</th>
                      <th scope="col">{t(k('new'))}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.trend.map((x) => (
                      <tr key={x.month}>
                        <th scope="row">{x.month}</th>
                        <td>{x.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
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

/** A small line chart in SVG: tokens for colour, no library. The table next to it carries the same numbers. */
function Trend({ data, label }: { data: { month: string; n: number }[]; label: string }) {
  const w = 480
  const h = 140
  const pad = 8
  const max = Math.max(1, ...data.map((d) => d.n))
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)
  const y = (n: number) => h - pad - (n / max) * (h - pad * 2)
  const line = data
    .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.n).toFixed(1)}`)
    .join('')
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path
        className="trend-area"
        d={`${line}L${x(data.length - 1)} ${h - pad}L${x(0)} ${h - pad}Z`}
      />
      <path className="trend-line" d={line} />
      {data.map((d, i) => (
        <circle key={d.month} className="trend-dot" cx={x(i)} cy={y(d.n)} r="3.5">
          <title>{`${d.month}: ${d.n}`}</title>
        </circle>
      ))}
    </svg>
  )
}
