import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { SelectField } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AreaChart, ChartCard, type Series } from './Charts'

type Analytics = {
  years: string[]
  attendance: boolean
  periods: {
    period: string
    men: number
    women: number
    children: number
    attendance: number
    offerings: number
  }[]
}
const k = (key: string) => `sundays.${key}` as MessageKey

/**
 * The year's progression of the Sunday numbers, month by month, under « Dimanche dernier ». The toggle offers only the years that
 * have data (decision 0043); the latest is shown first. Attendance by men, women and children, and the offerings.
 */
export function SundayYear() {
  const { t } = useLocale()
  const me = useMe().data
  const allowed = hasPermission(me, 'sundays:read')
  const [picked, setPicked] = useState<string | null>(null)
  // Which years have data (always the same answer, whatever year is shown), and the chosen year's months.
  const yq = useQuery({
    queryKey: ['sun-years'],
    queryFn: () => api<Analytics>('/sundays/analytics?grain=month'),
    enabled: allowed,
    staleTime: 60_000,
  })
  const years = yq.data?.years ?? []
  const year = picked && years.includes(picked) ? picked : years.at(-1)
  const shown = useQuery({
    queryKey: ['sun-year', year],
    queryFn: () => api<Analytics>(`/sundays/analytics?grain=month&year=${year}`),
    enabled: allowed && !!year,
    staleTime: 60_000,
  })
  if (!allowed || years.length === 0) return null
  const d = shown.data
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const at = (key: 'men' | 'women' | 'children' | 'offerings') =>
    months.map((m) => d?.periods.find((p) => p.period === m)?.[key] ?? 0)
  const people: Series[] = [
    { key: 'men', label: t(k('men')), values: at('men'), tone: 'primary' },
    { key: 'women', label: t(k('women')), values: at('women'), tone: 'gold' },
    { key: 'children', label: t(k('children')), values: at('children'), tone: 'clay' },
  ]
  const money: Series[] = [
    { key: 'money', label: t(k('offerings')), values: at('offerings'), tone: 'gold' },
  ]
  const header = t(k('month_h'))
  return (
    <section className="grid gap-4" aria-labelledby="sunyear-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sunyear-title" className="text-2xl">
          {t(k('year_t'))}
        </h2>
        {years.length > 1 && (
          <div className="media-select">
            <SelectField
              label={t(k('year_pick'))}
              value={year ?? ''}
              onValueChange={(v) => v && setPicked(v)}
              options={[...years].reverse().map((y) => ({ value: y, label: y }))}
            />
          </div>
        )}
      </div>
      {!d ? (
        <span className="skeleton h-40" aria-busy="true" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.attendance && (
            <ChartCard
              title={t(k('attendance'))}
              legend={people}
              table={{ months, series: people, monthHeader: header }}
              summary={t(k('view_numbers'))}
            >
              <AreaChart months={months} series={people} label={`${t(k('attendance'))} ${year}`} />
            </ChartCard>
          )}
          <ChartCard
            title={t(k('offerings'))}
            table={{ months, series: money, monthHeader: header }}
            summary={t(k('view_numbers'))}
          >
            <AreaChart months={months} series={money} label={`${t(k('offerings'))} ${year}`} />
          </ChartCard>
        </div>
      )}
    </section>
  )
}
