import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, ChartCard, Donut, type Series } from './Charts'

type Stats =
  | { configured: false }
  | {
      configured: true
      days: string[]
      perDay: { fr: number[]; en: number[] }
      top: { path: string; visits: number }[]
      devices: { mobile: number; desktop: number }
    }

/**
 * « Visites » on the admin home: 30 days of page views counted without any tracking (decision 0038): visits per day by
 * language, the most read pages, mobile vs desktop. Only for people who may see them; when the counter is not switched
 * on yet, one quiet panel says so.
 */
export function VisitsSection() {
  const { t } = useLocale()
  const me = useMe().data
  const q = useQuery({
    queryKey: ['visits'],
    queryFn: () => api<Stats>('/visits'),
    enabled: hasPermission(me, 'core:visits-read'),
    staleTime: 5 * 60_000,
  })
  const d = q.data
  if (!d) return null
  if (!d.configured)
    return (
      <section className="admin-panel" aria-labelledby="visits-title">
        <h2 id="visits-title" className="text-2xl">
          {t('dash.visits_title' as MessageKey)}
        </h2>
        <p className="text-ink-muted">{t('dash.visits_off' as MessageKey)}</p>
      </section>
    )
  const series: Series[] = [
    { key: 'fr', label: 'FR', values: d.perDay.fr, tone: 'primary' },
    { key: 'en', label: 'EN', values: d.perDay.en, tone: 'gold' },
  ]
  const total = d.perDay.fr.reduce((a, b) => a + b, 0) + d.perDay.en.reduce((a, b) => a + b, 0)
  return (
    <section className="grid gap-4" aria-labelledby="visits-title">
      <div className="grid gap-1">
        <h2 id="visits-title" className="text-2xl">
          {t('dash.visits_title' as MessageKey)}
        </h2>
        <p className="text-sm text-ink-muted">
          {t('dash.visits_lead' as MessageKey, { n: String(total) })}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t('dash.visits_chart' as MessageKey)}
          legend={series}
          table={{
            months: d.days,
            series,
            monthHeader: t('dash.visits_day' as MessageKey),
          }}
          summary={t('dash.view_numbers' as MessageKey)}
        >
          <AreaChart months={d.days} series={series} label={t('dash.visits_chart' as MessageKey)} />
        </ChartCard>
        <ChartCard title={t('dash.visits_device' as MessageKey)}>
          <Donut
            label={t('dash.visits_device' as MessageKey)}
            total={t('dash.total' as MessageKey)}
            parts={[
              {
                key: 'mobile',
                label: t('dash.visits_mobile' as MessageKey),
                n: d.devices.mobile,
                tone: 'primary',
              },
              {
                key: 'desktop',
                label: t('dash.visits_desktop' as MessageKey),
                n: d.devices.desktop,
                tone: 'gold',
              },
            ]}
          />
        </ChartCard>
        <div className="stat-card lg:col-span-2">
          <h3 className="text-lg">{t('dash.visits_top' as MessageKey)}</h3>
          <ol className="grid gap-1">
            {d.top.map((r) => (
              <li key={r.path} className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{r.path}</span>
                <span className="tabular-nums text-ink-muted">{r.visits}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-muted">{t('dash.visits_gap' as MessageKey)}</p>
        </div>
      </div>
    </section>
  )
}
