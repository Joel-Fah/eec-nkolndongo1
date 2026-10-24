/**
 * Bilan du dimanche (admin, /m/sundays): each Sunday's attendance (men, women, children: aggregates only) and offering lines
 * (a purpose, an amount, a group or the congregation), then the weekly and monthly trends. Nothing here is ever public (decision 0043).
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
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
  const [pick, setPick] = useState('')
  const last = hints.data?.lastSunday
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {last && (
          <Button onClick={() => onOpen(last)}>
            <Icon name="plus" size={20} />
            {t(k('last_sunday'), { date: dayText(last, locale, false) })}
          </Button>
        )}
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
                  <ul className="admin-grid-3">
                    {(list.data?.items ?? []).map((r) => (
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
function Trends() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const [grain, setGrain] = useState<'week' | 'month'>('month')
  const q = useQuery({
    queryKey: ['sun-analytics', grain],
    queryFn: () =>
      api<{
        attendance: boolean
        periods: Period[]
        purposes: { purpose: string; amount: number }[]
        groups: { groupId: string | null; amount: number; name: string | null }[]
      }>(`/sundays/analytics?grain=${grain}`),
  })
  const d = q.data
  const maxA = Math.max(1, ...(d?.periods ?? []).map((p) => p.attendance))
  const maxO = Math.max(1, ...(d?.periods ?? []).map((p) => p.offerings))
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
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="media-select">
          <SelectField
            label={t(k('grain'))}
            value={grain}
            onValueChange={(v) => v && setGrain(v as 'week' | 'month')}
            options={[
              { value: 'month', label: t(k('by_month')) },
              { value: 'week', label: t(k('by_week')) },
            ]}
          />
        </div>
        {hasPermission(me, 'sundays:export') && (
          <Button variant="secondary" onClick={exportCsv}>
            <Icon name="download" size={20} />
            {t(k('export'))}
          </Button>
        )}
      </div>
      {d && d.periods.length === 0 ? (
        <EmptyState title={t(k('trends_empty_t'))} text={t(k('trends_empty_p'))} />
      ) : (
        <div className="overflow-x-auto">
          <table className="chart-table sun-table">
            <thead>
              <tr>
                <th scope="col">{t(k('period'))}</th>
                {d?.attendance && <th scope="col">{t(k('attendance'))}</th>}
                <th scope="col">{t(k('offerings'))}</th>
              </tr>
            </thead>
            <tbody>
              {(d?.periods ?? []).map((p, i, all) => {
                const prev = all[i - 1]
                const ta = prev ? trend(p.attendance, prev.attendance) : null
                const to = prev ? trend(p.offerings, prev.offerings) : null
                return (
                  <tr key={p.period}>
                    <th scope="row">
                      {periodText(p.period, grain, locale)}
                      <small>{t(k('sundays_n'), { n: String(p.sundays) })}</small>
                    </th>
                    {d?.attendance && (
                      <td>
                        <span className="sun-bar" role="img" aria-label={`${p.attendance}`}>
                          <span data-k="men" style={{ width: `${(p.men / maxA) * 100}%` }} />
                          <span data-k="women" style={{ width: `${(p.women / maxA) * 100}%` }} />
                          <span
                            data-k="children"
                            style={{ width: `${(p.children / maxA) * 100}%` }}
                          />
                        </span>
                        <span className="sun-num">
                          <strong>{p.attendance}</strong> · {t(k('men_n'), { n: String(p.men) })} ·{' '}
                          {t(k('women_n'), { n: String(p.women) })} ·{' '}
                          {t(k('children_n'), { n: String(p.children) })}
                          {ta !== null && (
                            <em data-up={ta >= 0 ? '' : undefined}>
                              {ta > 0 ? '+' : ''}
                              {ta} %
                            </em>
                          )}
                        </span>
                      </td>
                    )}
                    <td>
                      <span className="sun-bar" role="img" aria-label={xaf(p.offerings)}>
                        <span data-k="money" style={{ width: `${(p.offerings / maxO) * 100}%` }} />
                      </span>
                      <span className="sun-num">
                        <strong>{xaf(p.offerings)}</strong>
                        {to !== null && (
                          <em data-up={to >= 0 ? '' : undefined}>
                            {to > 0 ? '+' : ''}
                            {to} %
                          </em>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
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
    </div>
  )
}

/* ── One Sunday ───────────────────────────────────────────────────────── */
function Sheet({ date, onBack }: { date: string; onBack: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['sun-report', date],
    queryFn: () => api<Report>(`/sundays/reports/${date}`),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['sun-report', date] })
    qc.invalidateQueries({ queryKey: ['sun-reports'] })
    qc.invalidateQueries({ queryKey: ['sun-analytics'] })
  }
  const close = useMutation({
    mutationFn: (closed: boolean) =>
      api(`/sundays/reports/${date}/close`, { method: 'POST', body: { closed } }),
    onSuccess: refresh,
    onError: () => say(t(k('error')), 'danger'),
  })
  const r = q.data
  if (!r) return <div className="admin-panel" aria-busy="true" />
  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
          {t(k('back'))}
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
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
          <h1 className="text-4xl">{dayText(date, locale)}</h1>
        </div>
        {hasPermission(me, 'sundays:close') && (
          <Button
            variant={r.closed ? 'secondary' : 'primary'}
            loading={close.isPending}
            onClick={() => close.mutate(!r.closed)}
          >
            {t(k(r.closed ? 'reopen' : 'close'))}
          </Button>
        )}
      </header>
      {r.closed && <p className="text-sm text-ink-muted">{t(k('closed_help'))}</p>}
      <div className="reg-grid reg-grid-2">
        {r.attendance !== null && <Attendance report={r} date={date} onChange={refresh} />}
        <Offerings report={r} date={date} onChange={refresh} />
      </div>
    </div>
  )
}

function Attendance({
  report,
  date,
  onChange,
}: {
  report: Report
  date: string
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
  })
  const save = useMutation({
    mutationFn: () =>
      api(`/sundays/reports/${date}/attendance`, {
        method: 'PUT',
        body: {
          men: num(v.men),
          women: num(v.women),
          children: num(v.children),
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
      api(`/sundays/reports/${date}/offerings`, {
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
  const groupName = (id: string | null) => {
    if (!id) return t(k('congregation'))
    const g = groups.data?.groups.find((x) => x.id === id)
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
                  {groupName(l.groupId)}
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
