import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Icon } from './Icon'
import { TrendBadge } from './TrendBadge'

type Item = {
  date: string
  attendance: number | null
  men: number | null
  women: number | null
  children: number | null
  offerings: number
  services: number
}
const k = (key: string) => `sundays.${key}` as MessageKey
const grouped = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')

/** The last Sunday's report on the dashboard: attendance and offerings with their change from the Sunday before (decision 0043). */
export function LastSunday() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const allowed = hasPermission(me, 'sundays:read')
  const q = useQuery({
    queryKey: ['sun-last'],
    queryFn: () => api<{ items: Item[] }>('/sundays/reports'),
    enabled: allowed,
  })
  // Sundays only: a special day (Christmas…) has no « Sunday before » to compare with.
  const sundays = (q.data?.items ?? []).filter(
    (i) => new Date(`${i.date}T12:00:00Z`).getUTCDay() === 0,
  )
  if (!allowed || sundays.length === 0) return null
  const [now, before] = sundays as [Item, Item | undefined]
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${now.date}T12:00:00Z`))
  const cards = [
    ...(now.attendance !== null
      ? [
          {
            key: 'attendance',
            n: now.attendance,
            prev: before?.attendance ?? 0,
            text: String(now.attendance),
            unit: '',
          },
        ]
      : []),
    {
      key: 'offerings',
      n: now.offerings,
      prev: before?.offerings ?? 0,
      text: grouped(now.offerings),
      unit: 'FCFA',
    },
  ]
  return (
    <section className="grid gap-4" aria-labelledby="lastsun-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="lastsun-title" className="text-2xl">
          {t(k('dash_t'))} <span className="text-ink-muted capitalize">· {day}</span>
        </h2>
        <Link
          to="/m/$module"
          params={{ module: 'sundays' }}
          hash={now.date}
          className="admin-dash-link"
        >
          {t(k('open'))}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className="stat-card">
            <p className="stat-number">
              {c.text}
              {c.unit && <small className="stat-unit">{c.unit}</small>}
            </p>
            <p className="text-sm text-ink-muted">{t(k(c.key))}</p>
            {before && <TrendBadge current={c.n} previous={c.prev} label={t(k('vs_previous'))} />}
          </div>
        ))}
        {now.attendance !== null && (
          <div className="stat-card sun-split">
            {(
              [
                ['male', 'men', now.men],
                ['female', 'women', now.women],
                ['baby', 'children', now.children],
              ] as const
            ).map(([icon, key, n]) => (
              <div key={key} className="sun-split-item">
                <Icon name={icon} size={20} />
                <p className="stat-number">{n ?? 0}</p>
                <p className="text-sm text-ink-muted">{t(k(key))}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
