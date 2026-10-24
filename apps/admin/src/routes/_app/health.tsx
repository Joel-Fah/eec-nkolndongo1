import { api, useLocale } from '@eec/admin-kit'
import { ViewToggle } from '@eec/content-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AreaChart, BarChart, type Series, type Tone } from '../../components/Charts'
import { Icon } from '../../components/Icon'
import { fmt, Gate, notify, PageHeader } from '../../components/kit'

export const Route = createFileRoute('/_app/health')({
  component: () => (
    <Gate permission="core:system-health">
      <Health />
    </Gate>
  ),
})

type Level = 'ok' | 'warn' | 'fail'
type Check = { id: string; level: Level; value: number | null; limit?: number }
type Latest = { checkedAt: string; status: Level; checks: Check[] }
type Day = { day: string; status: Level; checks: Check[] }
type Data = { latest: Latest | null; history: Day[] }

const TONE = { ok: 'success', warn: 'warning', fail: 'danger' } as const
const ICON = { ok: 'check', warn: 'clock', fail: 'alert' } as const
const MB = 1024 * 1024
const VIEW_KEY = 'eec-health-view'

function size(bytes: number, locale: string) {
  const n = bytes / MB
  const v = n >= 1024 ? n / 1024 : n
  const unit = locale === 'fr' ? (n >= 1024 ? 'Go' : 'Mo') : n >= 1024 ? 'GB' : 'MB'
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: n >= 1024 ? 1 : 0 }).format(v)} ${unit}`
}

/** Seven small bars, one a day, coloured by that day's state (like a status page). Grey = no check that day. */
function Strip({ id, history, days }: { id?: string; history: Day[]; days: string[] }) {
  const { t, locale } = useLocale()
  return (
    <ul className="health-strip" aria-label={t('admin.health.week')}>
      {days.map((d) => {
        const row = history.find((h) => h.day === d)
        const level = id ? row?.checks.find((c) => c.id === id)?.level : row?.status
        const day = new Intl.DateTimeFormat(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        }).format(new Date(`${d}T00:00:00Z`))
        const word = level
          ? t(`admin.health.status_${level}` as MessageKey)
          : t('admin.health.no_check')
        return (
          <li key={d} data-level={level ?? 'none'} data-tip={`${day} · ${word}`}>
            <span className="sr-only">{`${day} · ${word}`}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Health() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const [view, setViewState] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const setView = (v: 'grid' | 'list') => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {}
  }
  const q = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api<Data>('/system-health'),
  })
  const run = useMutation({
    mutationFn: () => api<Data>('/system-health/run', { method: 'POST' }),
    onSuccess: (d) => qc.setQueryData(['system-health'], d),
    onError: () => notify(t('admin.health.error'), { tone: 'danger' }),
  })
  const latest = q.data?.latest ?? null
  const history = q.data?.history ?? []
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
  )
  const phrase = (c: Check) => {
    const v = c.value
    switch (c.id) {
      case 'database':
        return t('admin.health.database_v', { n: String(v ?? '—') })
      case 'bucket':
        return t(c.level === 'ok' ? 'admin.health.bucket_ok' : 'admin.health.bucket_fail')
      case 'backup':
        return v === null
          ? t('admin.health.backup_none')
          : t('admin.health.backup_v', { n: String(v) })
      case 'outbox':
        return t('admin.health.outbox_v', { n: String(v ?? 0) })
      default:
        return t('admin.health.size_v', {
          used: size(v ?? 0, locale),
          limit: size(c.limit ?? 0, locale),
          pct: String(Math.round(((v ?? 0) / (c.limit || 1)) * 100)),
        })
    }
  }
  /** The week of one number, as a soft area (or bars for a count), for the checks that have one. */
  const visual = (c: Check) => {
    const points = days.map((d) => {
      const v = history.find((h) => h.day === d)?.checks.find((x) => x.id === c.id)?.value
      return v ?? 0
    })
    const has = history.length > 1
    const tone: Tone = c.level === 'ok' ? 'primary' : c.level === 'warn' ? 'gold' : 'clay'
    const series: Series = {
      key: c.id,
      label: t(`admin.health.${c.id}` as MessageKey),
      values:
        c.id === 'dbSize' || c.id === 'mediaSize' ? points.map((v) => Math.round(v / MB)) : points,
      tone,
    }
    if (c.id === 'dbSize' || c.id === 'mediaSize') {
      const pct = Math.min(100, Math.round(((c.value ?? 0) / (c.limit || 1)) * 100))
      return (
        <>
          <div className="health-meter" role="img" aria-label={`${pct} %`} data-level={c.level}>
            <span style={{ inlineSize: `${Math.max(pct, 2)}%` }} />
            <i style={{ insetInlineStart: '70%' }} aria-hidden="true" />
          </div>
          {has && <AreaChart months={days} series={[series]} label={series.label} />}
        </>
      )
    }
    if (c.id === 'database' && has)
      return <AreaChart months={days} series={[series]} label={series.label} />
    if (c.id === 'outbox' && has)
      return <BarChart months={days} series={series} label={series.label} />
    if (c.id === 'backup') {
      const age = c.value ?? 0
      const pct = Math.min(100, Math.round((age / 15) * 100))
      return (
        <div
          className="health-meter"
          role="img"
          aria-label={t('admin.health.backup_v', { n: String(age) })}
          data-level={c.level}
        >
          <span style={{ inlineSize: `${Math.max(pct, 2)}%` }} />
          <i style={{ insetInlineStart: `${Math.round((9 / 15) * 100)}%` }} aria-hidden="true" />
        </div>
      )
    }
    return null
  }
  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('admin.health.title')}
        lead={t('admin.health.lead')}
        actions={
          <>
            <ViewToggle
              value={view}
              onChange={setView}
              label={t('admin.health.view')}
              options={[
                { id: 'grid', label: t('admin.health.view_grid'), icon: 'gridView' },
                { id: 'list', label: t('admin.health.view_list'), icon: 'layoutList' },
              ]}
            />
            <Button loading={run.isPending} onClick={() => run.mutate()}>
              {t(run.isPending ? 'admin.health.running' : 'admin.health.run')}
            </Button>
          </>
        }
      />
      {q.data && !latest && <p className="admin-panel">{t('admin.health.never')}</p>}
      {latest && (
        <>
          <section className={`health-banner health-banner-${latest.status}`} role="status">
            <span className="health-banner-icon" aria-hidden="true">
              <Icon name={ICON[latest.status]} size={24} />
            </span>
            <div className="grid gap-1">
              <h2 className="text-xl">{t(`admin.health.status_${latest.status}` as MessageKey)}</h2>
              <p className="text-sm">
                {t('admin.health.last', { date: fmt(latest.checkedAt, locale) })}
              </p>
            </div>
            <div className="health-banner-strip">
              <Strip history={history} days={days} />
              <span className="text-xs">{t('admin.health.week')}</span>
            </div>
          </section>
          <ul
            className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-3'}
            data-view={view}
          >
            {latest.checks.map((c) => (
              <li
                key={c.id}
                className="admin-panel health-card"
                data-level={c.level}
                data-view={view}
              >
                <div className="health-card-head">
                  <h2 className="text-lg">{t(`admin.health.${c.id}` as MessageKey)}</h2>
                  <Badge tone={TONE[c.level]}>
                    <Icon name={ICON[c.level]} size={16} />
                    {t(`admin.health.status_${c.level}` as MessageKey)}
                  </Badge>
                </div>
                <p className="font-medium">{phrase(c)}</p>
                <Strip id={c.id} history={history} days={days} />
                {view === 'grid' && visual(c)}
                {c.level !== 'ok' && (
                  <p className="text-sm text-ink-muted">
                    {t(`admin.health.help_${c.id}` as MessageKey)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <section className="admin-panel">
        <h2 className="text-lg">{t('admin.health.elsewhere_title')}</h2>
        <p className="text-ink-muted">{t('admin.health.elsewhere')}</p>
      </section>
    </div>
  )
}
