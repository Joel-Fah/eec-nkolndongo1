/**
 * Bilan du dimanche (admin, /m/sundays): each Sunday's attendance (men, women, children: aggregates only) and offering lines
 * (a purpose, an amount, a group or the congregation), then the weekly and monthly trends. Nothing here is ever public (decision 0043).
 */
import {
  AreaChart,
  api,
  ChartCard,
  hasPermission,
  monthName,
  type Series,
  useLocale,
  useMe,
} from '@eec/admin-kit'
import { ConfirmDialog } from '@eec/content-kit'
import { purposeLabel, SUNDAY_PURPOSES } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  SelectField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { attendanceTotal, isSundayDate, trend, xaf } from './rules.ts'

type Line = {
  groupName?: { fr: string; en: string } | null
  id: string
  purpose: string
  amountXaf: number
  groupId: string | null
  campaignId: string | null
  linked: boolean
}
type Report = {
  id: string
  date: string
  n: number
  serviceName: string
  services: number
  men: number | null
  women: number | null
  children: number | null
  attendance: number | null
  serviceKind: 'ordinary' | 'special'
  serviceLabel: string
  note: string
  closed: boolean
  offerings: number
  lines: Line[]
}
type Hints = {
  lastSunday: string
  today: string
  custom: string[]
  campaigns: { id: string; title: string }[]
}
type Group = { id: string; nameFr: string; nameEn: string | null }

const k = (key: string) => `sundays.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
const dayText = (d: string, locale: string, long = true) =>
  new Intl.DateTimeFormat(locale, {
    weekday: long ? 'long' : undefined,
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${d}T12:00:00Z`))
const num = (v: string) =>
  v.trim() === '' ? null : Math.max(0, Math.min(100000, Number(v.replace(/\D/g, '')) || 0))
const periodText = (p: string, grain: string, locale: string) =>
  grain === 'month'
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${p}-01T12:00:00Z`),
      )
    : `${dayText(p, locale, false)}`
const useGroups = () =>
  useQuery({
    queryKey: ['groups-light'],
    queryFn: () => api<{ groups: Group[] }>('/groups'),
    staleTime: 60_000,
  })

export default function SundaysPage() {
  const [openDate, setOpenDate] = useState<string | null>(() => location.hash.slice(1) || null)
  useEffect(() => {
    const on = () => setOpenDate(location.hash.slice(1) || null)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const open = (d: string | null) => {
    history.replaceState(null, '', d ? `#${d}` : location.pathname + location.search)
    setOpenDate(d)
  }
  return openDate && isSundayDate(openDate) ? (
    <Sheet date={openDate} onBack={() => open(null)} />
  ) : (
    <Home onOpen={open} />
  )
}

/* ── The Sundays and the trends ───────────────────────────────────────── */
function Home({ onOpen }: { onOpen: (d: string) => void }) {
  const { t, locale } = useLocale()
  const hints = useQuery({ queryKey: ['sun-hints'], queryFn: () => api<Hints>('/sundays/hints') })
  const list = useQuery({
    queryKey: ['sun-reports'],
    queryFn: () => api<{ items: Report[] }>('/sundays/reports'),
  })
  const me = useMe().data
  const [pick, setPick] = useState('')
  const last = hints.data?.lastSunday
  // The Sundays, a month at a time (newest first).
  const months = [
    ...(list.data?.items ?? []).reduce(
      (m, r) => m.set(r.date.slice(0, 7), [...(m.get(r.date.slice(0, 7)) ?? []), r]),
      new Map<string, Report[]>(),
    ),
  ]
  const exportCsv = async () => {
    const res = await fetch('/api/sundays/export.csv', { credentials: 'include' })
    if (!res.ok) return say(t(k('error')), 'danger')
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = 'bilans-dimanche.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission(me, 'sundays:export') && (
            <Button variant="secondary" onClick={exportCsv}>
              <Icon name="download" size={20} />
              {t(k('export'))}
            </Button>
          )}
          {last && (
            <Button onClick={() => onOpen(last)}>
              <Icon name="plus" size={20} />
              {t(k('last_sunday'), { date: dayText(last, locale, false) })}
            </Button>
          )}
        </div>
      </header>
      <TabsBox
        tabs={[
          {
            id: 'sundays',
            label: t(k('tab_sundays')),
            content: (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <TextField
                    label={t(k('other_sunday'))}
                    type="date"
                    placeholder=""
                    max={hints.data?.today}
                    value={pick}
                    hint={pick && !isSundayDate(pick) ? t(k('not_sunday')) : undefined}
                    onChange={(e: { target: { value: string } }) => setPick(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={!isSundayDate(pick)}
                    onClick={() => onOpen(pick)}
                  >
                    {t(k('open'))}
                  </Button>
                </div>
                {list.data && list.data.items.length === 0 ? (
                  <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
                ) : (
                  <div className="grid gap-6">
                    {months.map(([ym, items]) => (
                      <section
                        key={ym}
                        className="grid gap-3"
                        aria-label={periodText(ym, 'month', locale)}
                      >
                        <h2 className="sermon-month">
                          {periodText(ym, 'month', locale)}
                          <span>{items.length}</span>
                        </h2>
                        <ul className="admin-grid-4">
                          {items.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                className="admin-panel plan-tile"
                                onClick={() => onOpen(r.date)}
                              >
                                <span className="flex flex-wrap items-center gap-2">
                                  {r.closed && <Badge tone="success">{t(k('closed'))}</Badge>}
                                  {r.serviceKind === 'special' && (
                                    <Badge tone="gold">{r.serviceLabel || t(k('special'))}</Badge>
                                  )}
                                  {r.services > 1 && (
                                    <Badge>{t(k('services_n'), { n: String(r.services) })}</Badge>
                                  )}
                                </span>
                                <strong className="font-display text-2xl">
                                  {dayText(r.date, locale)}
                                </strong>
                                {r.attendance !== null && (
                                  <span className="text-sm">
                                    {t(k('present_n'), { n: String(r.attendance) })}
                                  </span>
                                )}
                                <span className="text-sm text-ink-muted">{xaf(r.offerings)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          { id: 'trends', label: t(k('tab_trends')), content: <Trends /> },
        ]}
      />
    </div>
  )
}

/* ── Trends: weekly or monthly, numbers beside every bar ──────────────── */
type Period = {
  period: string
  sundays: number
  men: number
  women: number
  children: number
  attendance: number
  offerings: number
  byPurpose: Record<string, number>
}
/** « ▲ +12 % »: the change with its arrow (green up, red down), written out for screen readers too. */
function Delta({ value }: { value: number | null | undefined }) {
  const { t } = useLocale()
  if (value === null || value === undefined) return null
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  return (
    <span className="trend-badge sun-delta" data-direction={dir}>
      {dir !== 'flat' && <Icon name={dir === 'up' ? 'trendUp' : 'trendDown'} size={16} />}
      <span aria-hidden="true">
        {value > 0 ? '+' : ''}
        {value} %
      </span>
      <span className="sr-only">
        {t(k(`trend_${dir}`))} {Math.abs(value)} %
      </span>
    </span>
  )
}

/** One measure: its bar, and right under it what it is and how much (the label always sits under its own progress). */
function Meter({
  tone,
  icon,
  label,
  value,
  ratio,
  change,
}: {
  tone: 'men' | 'women' | 'children' | 'money'
  icon?: 'male' | 'female' | 'baby' | 'money'
  label: string
  value: string
  ratio: number
  change?: number | null
}) {
  return (
    <div className="sun-meter" data-k={tone}>
      <span className="sun-bar" role="img" aria-label={`${label}: ${value}`}>
        <span data-k={tone} style={{ width: `${Math.max(Math.min(ratio, 1), 0) * 100}%` }} />
      </span>
      <span className="sun-meter-label">
        {icon && <Icon name={icon} size={16} />}
        <span>{label}</span>
        <strong>{value}</strong>
        <Delta value={change} />
      </span>
    </div>
  )
}

function Trends() {
  const { t, locale } = useLocale()
  const q = useQuery({
    queryKey: ['sun-analytics', 'all'],
    queryFn: () =>
      api<{
        attendance: boolean
        periods: Period[]
        purposes: { purpose: string; amount: number }[]
        groups: { groupId: string | null; amount: number; name: string | null }[]
      }>(`/sundays/analytics?grain=month&from=2000-01-01`),
  })
  const d = q.data
  const periods = d?.periods ?? []
  // The three attendance bars share one scale, so they can be compared; the offerings have their own.
  const maxA = Math.max(1, ...periods.flatMap((p) => [p.men, p.women, p.children]))
  const maxO = Math.max(1, ...periods.map((p) => p.offerings))
  // The chart is the weeks of the current month (its Sundays, oldest first); every month is on the dashboard.
  const today = new Date().toISOString().slice(0, 10)
  const first = `${today.slice(0, 7)}-01`
  const wk = useQuery({
    queryKey: ['sun-month', first],
    queryFn: () =>
      api<{
        items: {
          date: string
          men: number | null
          women: number | null
          children: number | null
          offerings: number
        }[]
      }>(`/sundays/reports?from=${first}&to=${today}`),
  })
  const sundays = [...(wk.data?.items ?? [])].sort((x, y) => x.date.localeCompare(y.date))
  const days = sundays.map((s) => s.date)
  const per = (key: 'men' | 'women' | 'children' | 'offerings') => sundays.map((s) => s[key] ?? 0)
  const people: Series[] = [
    { key: 'men', label: t(k('men')), values: per('men'), tone: 'primary' },
    { key: 'women', label: t(k('women')), values: per('women'), tone: 'gold' },
    { key: 'children', label: t(k('children')), values: per('children'), tone: 'clay' },
  ]
  const money: Series[] = [
    { key: 'money', label: t(k('offerings')), values: per('offerings'), tone: 'gold' },
  ]
  const monthLabel = monthName(first.slice(0, 7), locale)
  // The cards, a year at a time (newest year first, months in order inside it); the change is against the month before.
  const years = [...new Set(periods.map((p) => p.period.slice(0, 4)))].sort().reverse()
  return (
    <div className="grid gap-8">
      {d && periods.length === 0 ? (
        <EmptyState title={t(k('trends_empty_t'))} text={t(k('trends_empty_p'))} />
      ) : (
        <>
          {days.length > 0 && (
            <div className="grid gap-6">
              {d?.attendance && (
                <ChartCard title={`${t(k('attendance'))} · ${monthLabel}`} legend={people}>
                  <AreaChart wide months={days} series={people} label={t(k('attendance'))} />
                </ChartCard>
              )}
              <ChartCard title={`${t(k('offerings'))} · ${monthLabel}`}>
                <AreaChart wide months={days} series={money} label={t(k('offerings'))} />
              </ChartCard>
            </div>
          )}
          {years.map((y) => (
            <section key={y} className="grid gap-3" aria-label={y}>
              <h2 className="sermon-month">
                {y}
                <span>{periods.filter((p) => p.period.startsWith(y)).length}</span>
              </h2>
              <ul className="sun-months">
                {periods
                  .filter((p) => p.period.startsWith(y))
                  .map((p) => {
                    const prev = periods[periods.indexOf(p) - 1]
                    return (
                      <li key={p.period} className="sun-month admin-panel">
                        <h3 className="sun-month-h">
                          {periodText(p.period, 'month', locale).replace(/\s\d{4}$/, '')}
                          <small>{t(k('sundays_n'), { n: String(p.sundays) })}</small>
                        </h3>
                        <div className="sun-month-grid">
                          {d?.attendance && (
                            <>
                              <Meter
                                tone="men"
                                icon="male"
                                label={t(k('men'))}
                                value={String(p.men)}
                                ratio={p.men / maxA}
                                change={prev ? trend(p.men, prev.men) : null}
                              />
                              <Meter
                                tone="women"
                                icon="female"
                                label={t(k('women'))}
                                value={String(p.women)}
                                ratio={p.women / maxA}
                                change={prev ? trend(p.women, prev.women) : null}
                              />
                              <Meter
                                tone="children"
                                icon="baby"
                                label={t(k('children'))}
                                value={String(p.children)}
                                ratio={p.children / maxA}
                                change={prev ? trend(p.children, prev.children) : null}
                              />
                            </>
                          )}
                          <Meter
                            tone="money"
                            icon="money"
                            label={t(k('offerings'))}
                            value={xaf(p.offerings)}
                            ratio={p.offerings / maxO}
                            change={prev ? trend(p.offerings, prev.offerings) : null}
                          />
                        </div>
                        {d?.attendance && (
                          <p className="sun-total">
                            {t(k('present_n'), { n: String(p.attendance) })}
                            <Delta value={prev ? trend(p.attendance, prev.attendance) : null} />
                          </p>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))}
          {d && d.purposes.length > 0 && (
            <div className="reg-grid reg-grid-2">
              <section className="admin-panel grid gap-2">
                <h3 className="text-lg">{t(k('by_purpose'))}</h3>
                <ul className="grid gap-1">
                  {d.purposes.map((p) => (
                    <li key={p.purpose} className="flex justify-between gap-3">
                      <span>{purposeLabel(p.purpose, locale === 'en' ? 'en' : 'fr')}</span>
                      <strong>{xaf(p.amount)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="admin-panel grid gap-2">
                <h3 className="text-lg">{t(k('by_group'))}</h3>
                <ul className="grid gap-1">
                  {d.groups.map((g) => (
                    <li key={g.groupId ?? 'all'} className="flex justify-between gap-3">
                      <span>{g.name ?? t(k('congregation'))}</span>
                      <strong>{xaf(g.amount)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── One Sunday ───────────────────────────────────────────────────────── */
type Sheet = { date: string; services: Report[] }
const blankService = (date: string, n: number): Report => ({
  id: '',
  date,
  n,
  serviceName: '',
  men: null,
  women: null,
  children: null,
  attendance: 0,
  serviceKind: 'ordinary',
  serviceLabel: '',
  note: '',
  closed: false,
  offerings: 0,
  services: 1,
  lines: [],
})

function Sheet({ date, onBack }: { date: string; onBack: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [extra, setExtra] = useState(1)
  const q = useQuery({
    queryKey: ['sun-report', date],
    queryFn: () => api<Sheet>(`/sundays/reports/${date}`),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['sun-report', date] })
    qc.invalidateQueries({ queryKey: ['sun-reports'] })
    qc.invalidateQueries({ queryKey: ['sun-analytics'] })
    qc.invalidateQueries({ queryKey: ['sun-last'] })
  }
  const close = useMutation({
    mutationFn: (x: { n: number; closed: boolean }) =>
      api(`/sundays/reports/${date}/close?n=${x.n}`, {
        method: 'POST',
        body: { closed: x.closed },
      }),
    onSuccess: refresh,
    onError: () => say(t(k('error')), 'danger'),
  })
  const data = q.data
  if (!data) return <div className="admin-panel" aria-busy="true" />
  // The services that exist, plus the ones just added and not yet saved (a new service is created by its first save).
  const count = Math.min(Math.max(data.services.length, extra), 6)
  const services = Array.from(
    { length: count },
    (_, i) => data.services.find((x) => x.n === i + 1) ?? blankService(date, i + 1),
  )
  const several = services.length > 1
  const canAdd = hasPermission(me, 'sundays:attendance') || hasPermission(me, 'sundays:offerings')
  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
          {t(k('back'))}
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-4xl">{dayText(date, locale)}</h1>
        {canAdd && count < 6 && (
          <Button variant="secondary" onClick={() => setExtra(count + 1)}>
            <Icon name="plus" size={20} />
            {t(k('add_service'))}
          </Button>
        )}
      </header>
      <TabsBox
        tabs={services.map((r) => ({
          id: `s${r.n}`,
          label: r.serviceName || t(k('service_n'), { n: String(r.n) }),
          content: (
            <div className="grid gap-5" key={`${r.n}-${r.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex flex-wrap items-center gap-2">
                  {r.closed ? (
                    <Badge tone="success">{t(k('closed'))}</Badge>
                  ) : (
                    <Badge tone="warning">{t(k('open_state'))}</Badge>
                  )}
                  {r.serviceKind === 'special' && (
                    <Badge tone="gold">{r.serviceLabel || t(k('special'))}</Badge>
                  )}
                </span>
                {r.id && hasPermission(me, 'sundays:close') && (
                  <Button
                    variant={r.closed ? 'secondary' : 'primary'}
                    loading={close.isPending}
                    onClick={() => close.mutate({ n: r.n, closed: !r.closed })}
                  >
                    {t(k(r.closed ? 'reopen' : 'close'))}
                  </Button>
                )}
              </div>
              {r.closed && <p className="text-sm text-ink-muted">{t(k('closed_help'))}</p>}
              <div className="reg-grid reg-grid-2">
                {(r.attendance !== null || !r.id) && (
                  <Attendance report={r} date={date} several={several} onChange={refresh} />
                )}
                <Offerings report={r} date={date} onChange={refresh} />
              </div>
            </div>
          ),
        }))}
      />
    </div>
  )
}

function Attendance({
  report,
  date,
  several,
  onChange,
}: {
  report: Report
  date: string
  several: boolean
  onChange: () => void
}) {
  const { t } = useLocale()
  const me = useMe().data
  const can = hasPermission(me, 'sundays:attendance') && !report.closed
  const [v, setV] = useState({
    men: report.men === null ? '' : String(report.men),
    women: report.women === null ? '' : String(report.women),
    children: report.children === null ? '' : String(report.children),
    special: report.serviceKind === 'special',
    label: report.serviceLabel,
    note: report.note,
    name: report.serviceName,
  })
  const save = useMutation({
    mutationFn: () =>
      api(`/sundays/reports/${date}/attendance?n=${report.n}`, {
        method: 'PUT',
        body: {
          men: num(v.men),
          women: num(v.women),
          children: num(v.children),
          serviceName: v.name,
          serviceKind: v.special ? 'special' : 'ordinary',
          serviceLabel: v.special ? v.label : '',
          note: v.note,
        },
      }),
    onSuccess: () => {
      say(t(k('saved')))
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const total = attendanceTotal({ men: num(v.men), women: num(v.women), children: num(v.children) })
  const field = (key: 'men' | 'women' | 'children') => (
    <TextField
      label={t(k(key))}
      placeholder="0"
      inputMode="numeric"
      value={v[key]}
      disabled={!can}
      onChange={(e: { target: { value: string } }) =>
        setV((x) => ({ ...x, [key]: e.target.value.replace(/\D/g, '') }))
      }
    />
  )
  return (
    <section className="admin-panel grid gap-3" aria-label={t(k('attendance'))}>
      <h2 className="text-xl">{t(k('attendance'))}</h2>
      <div className="reg-grid reg-grid-3">
        {field('men')}
        {field('women')}
        {field('children')}
      </div>
      {several && (
        <TextField
          label={t(k('service_name'))}
          placeholder={t(k('service_name_ph'))}
          maxLength={60}
          value={v.name}
          disabled={!can}
          onChange={(e: { target: { value: string } }) =>
            setV((x) => ({ ...x, name: e.target.value }))
          }
        />
      )}
      <p className="font-display text-3xl">{t(k('present_n'), { n: String(total) })}</p>
      <label className="check-row">
        <input
          type="checkbox"
          className="checkbox"
          checked={v.special}
          disabled={!can}
          onChange={(e) => setV((x) => ({ ...x, special: e.target.checked }))}
        />
        <span>{t(k('special_sunday'))}</span>
      </label>
      {v.special && (
        <TextField
          label={t(k('special_label'))}
          placeholder={t(k('special_ph'))}
          value={v.label}
          disabled={!can}
          maxLength={80}
          onChange={(e: { target: { value: string } }) =>
            setV((x) => ({ ...x, label: e.target.value }))
          }
        />
      )}
      <TextField
        label={t(k('note'))}
        placeholder=""
        hint={t(k('note_help'))}
        maxLength={120}
        value={v.note}
        disabled={!can}
        onChange={(e: { target: { value: string } }) =>
          setV((x) => ({ ...x, note: e.target.value }))
        }
      />
      {can && (
        <div>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {t(k('save'))}
          </Button>
        </div>
      )}
    </section>
  )
}

function Offerings({
  report,
  date,
  onChange,
}: {
  report: Report
  date: string
  onChange: () => void
}) {
  const { t, locale } = useLocale()
  const lang = locale === 'en' ? 'en' : 'fr'
  const me = useMe().data
  const can = hasPermission(me, 'sundays:offerings') && !report.closed
  const groups = useGroups()
  const hints = useQuery({ queryKey: ['sun-hints'], queryFn: () => api<Hints>('/sundays/hints') })
  const [v, setV] = useState({
    purpose: 'ordinaire',
    custom: '',
    amount: '',
    groupId: '',
    campaignId: '',
  })
  const [drop, setDrop] = useState<Line | null>(null)
  const purpose = v.purpose === '__custom' ? v.custom.trim() : v.purpose
  const amount = Number(v.amount.replace(/\D/g, ''))
  const add = useMutation({
    mutationFn: () =>
      api(`/sundays/reports/${date}/offerings?n=${report.n}`, {
        method: 'POST',
        body: {
          purpose,
          amountXaf: amount,
          groupId: v.groupId || null,
          campaignId: purpose === 'moissons' ? v.campaignId || null : null,
        },
      }),
    onSuccess: () => {
      setV((x) => ({ ...x, amount: '', custom: '' }))
      say(t(k('line_added')))
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api(`/sundays/offerings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDrop(null)
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const groupName = (l: Line) => {
    if (!l.groupId) return t(k('congregation'))
    if (l.groupName) return l.groupName[lang]
    const g = groups.data?.groups.find((x) => x.id === l.groupId)
    return g ? (lang === 'en' && g.nameEn) || g.nameFr : '…'
  }
  const suggestions = hints.data?.custom ?? []
  return (
    <section className="admin-panel grid gap-3" aria-label={t(k('offerings'))}>
      <h2 className="text-xl">{t(k('offerings'))}</h2>
      <p className="font-display text-3xl">{xaf(report.offerings)}</p>
      {report.lines.length === 0 ? (
        <p className="text-sm text-ink-muted">{t(k('no_lines'))}</p>
      ) : (
        <ul className="grid gap-1">
          {report.lines.map((l) => (
            <li key={l.id} className="sun-line">
              <span className="grid">
                <strong>{purposeLabel(l.purpose, lang)}</strong>
                <span className="text-sm text-ink-muted">
                  {groupName(l)}
                  {l.linked ? ` · ${t(k('linked'))}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <strong>{xaf(l.amountXaf)}</strong>
                {can && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t(k('delete_line'))}
                    onClick={() => setDrop(l)}
                  >
                    <Icon name="trash" size={16} />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {can && (
        <div className="grid gap-3 sun-add">
          <h3 className="text-lg">{t(k('add_line'))}</h3>
          <fieldset className="sun-chips">
            <legend className="field-label">{t(k('purpose'))}</legend>
            {[
              ...SUNDAY_PURPOSES.map((p) => ({ key: p.key as string, label: p[lang] })),
              ...suggestions.map((s) => ({ key: s, label: s })),
              { key: '__custom', label: t(k('other_purpose')) },
            ].map((p) => (
              <label key={p.key} className="sun-chip">
                <input
                  type="radio"
                  name="purpose"
                  checked={v.purpose === p.key}
                  onChange={() => setV((x) => ({ ...x, purpose: p.key }))}
                />
                <span>{p.label}</span>
              </label>
            ))}
          </fieldset>
          {v.purpose === '__custom' && (
            <TextField
              label={t(k('custom_purpose'))}
              placeholder={t(k('custom_ph'))}
              maxLength={60}
              value={v.custom}
              onChange={(e: { target: { value: string } }) =>
                setV((x) => ({ ...x, custom: e.target.value }))
              }
            />
          )}
          <div className="reg-grid reg-grid-2">
            <TextField
              label={t(k('amount'))}
              placeholder="50 000"
              inputMode="numeric"
              hint={amount ? xaf(amount) : undefined}
              value={v.amount}
              onChange={(e: { target: { value: string } }) =>
                setV((x) => ({ ...x, amount: e.target.value }))
              }
            />
            <SelectField
              label={t(k('group'))}
              value={v.groupId || 'none'}
              onValueChange={(x) => setV((y) => ({ ...y, groupId: !x || x === 'none' ? '' : x }))}
              options={[
                { value: 'none', label: t(k('congregation')) },
                ...(groups.data?.groups ?? []).map((g) => ({
                  value: g.id,
                  label: (lang === 'en' && g.nameEn) || g.nameFr,
                })),
              ]}
            />
          </div>
          {purpose === 'moissons' && (hints.data?.campaigns.length ?? 0) > 0 && (
            <SelectField
              label={t(k('campaign'))}
              value={v.campaignId || 'none'}
              onValueChange={(x) =>
                setV((y) => ({ ...y, campaignId: !x || x === 'none' ? '' : x }))
              }
              options={[
                { value: 'none', label: t(k('no_campaign')) },
                ...(hints.data?.campaigns ?? []).map((c) => ({ value: c.id, label: c.title })),
              ]}
            />
          )}
          {purpose === 'moissons' && v.campaignId && (
            <p className="text-sm text-ink-muted">{t(k('campaign_help'))}</p>
          )}
          <div>
            <Button
              loading={add.isPending}
              disabled={!purpose || !amount}
              onClick={() => add.mutate()}
            >
              {t(k('add_go'))}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!drop}
        onClose={() => setDrop(null)}
        title={t(k('delete_line_t'))}
        text={t(k('delete_line_p'))}
        confirmLabel={t(k('delete_line'))}
        danger
        busy={del.isPending}
        onConfirm={() => drop && del.mutate(drop.id)}
      />
    </section>
  )
}
