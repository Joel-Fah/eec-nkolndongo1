import { api, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, BarChart, ChartCard, Donut, type Series, type Tone } from './Charts'

type Trends = {
  months: string[]
  messages?: number[]
  messagesByCategory?: { category: string; n: number }[]
  news?: number[]
  events?: number[]
  media?: number[]
}
const TONES: Tone[] = ['primary', 'gold', 'info', 'clay', 'success']

/** At the bottom of the admin home: twelve months of what the team receives and publishes, as soft area and bar charts. */
export function TrendsSection() {
  const { t } = useLocale()
  const me = useMe().data
  const q = useQuery({
    queryKey: ['trends'],
    queryFn: () => api<Trends>('/trends'),
    enabled: !!me,
    staleTime: 60_000,
  })
  const d = q.data
  if (!d) return null
  const monthHeader = t('dash.month' as MessageKey)
  const view = t('dash.view_numbers' as MessageKey)
  const messages: Series | null = d.messages
    ? {
        key: 'm',
        label: t('dash.series_messages' as MessageKey),
        values: d.messages,
        tone: 'primary',
      }
    : null
  const publications: Series[] = [
    d.news && {
      key: 'n',
      label: t('dash.series_news' as MessageKey),
      values: d.news,
      tone: 'primary' as Tone,
    },
    d.events && {
      key: 'e',
      label: t('dash.series_events' as MessageKey),
      values: d.events,
      tone: 'gold' as Tone,
    },
  ].filter(Boolean) as Series[]
  const media: Series | null = d.media
    ? { key: 'p', label: t('dash.series_media' as MessageKey), values: d.media, tone: 'info' }
    : null
  const cats = d.messagesByCategory ?? []
  const any = messages || publications.length || media || cats.length
  if (!any) return null
  return (
    <section className="grid gap-4" aria-labelledby="trends-title">
      <h2 id="trends-title" className="text-2xl">
        {t('dash.trends_title' as MessageKey)}
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {messages && (
          <ChartCard
            title={t('dash.chart_messages' as MessageKey)}
            table={{ months: d.months, series: [messages], monthHeader }}
            summary={view}
          >
            <AreaChart
              months={d.months}
              series={[messages]}
              label={t('dash.chart_messages' as MessageKey)}
            />
          </ChartCard>
        )}
        {publications.length > 0 && (
          <ChartCard
            title={t('dash.chart_publications' as MessageKey)}
            legend={publications}
            table={{ months: d.months, series: publications, monthHeader }}
            summary={view}
          >
            <AreaChart
              months={d.months}
              series={publications}
              label={t('dash.chart_publications' as MessageKey)}
            />
          </ChartCard>
        )}
        {media && (
          <ChartCard
            title={t('dash.chart_media' as MessageKey)}
            table={{ months: d.months, series: [media], monthHeader }}
            summary={view}
          >
            <BarChart
              months={d.months}
              series={media}
              label={t('dash.chart_media' as MessageKey)}
            />
          </ChartCard>
        )}
        {cats.length > 0 && (
          <ChartCard title={t('dash.chart_categories' as MessageKey)}>
            <Donut
              label={t('dash.chart_categories' as MessageKey)}
              total={t('dash.total' as MessageKey)}
              parts={cats.map((c, i) => ({
                key: c.category,
                label: t(`contact.cat_${c.category}` as MessageKey),
                n: c.n,
                tone: TONES[i % TONES.length] as Tone,
              }))}
            />
          </ChartCard>
        )}
      </div>
    </section>
  )
}
