/**
 * Agenda (admin, /m/events): a list and a month calendar, and the editor — title, description (FR/EN), when (with
 * repeat), place, group, cover — with autosave, the shared publish dialog, versions, preview, duplicate, and a
 * « coming dates » panel to cancel or move one date of a repeating event.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import {
  ConfirmDialog,
  CoverField,
  PublishDialog,
  RevisionsDrawer,
  SaveIndicator,
  StatusBadge,
  useAutosave,
  ViewToggle,
} from '@eec/content-kit'
import {
  type Doc,
  daysBetween,
  EMPTY_DOC,
  EVENT_KIND_STYLE,
  EVENT_KINDS,
  type EventKind,
  type Exception,
  expandOccurrences,
  localParts,
  publishProblems,
  type Recurrence,
  type Status,
  shortDate,
  spanDays,
  weekLabel,
  weekOf,
  zonedToUtc,
} from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  SelectField,
  SwitchField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'

const RichTextEditor = lazy(() => import('@eec/content-kit/editor'))

type Item = {
  id: string
  slug: string
  status: Status
  groupId: string | null
  groupName: string | null
  publishAt: string | null
  unpublishAt: string | null
  featured: boolean
  kind: string
  titleFr: string
  titleEn: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  timezone: string
  recurrence: Recurrence | null
  exceptions: Exception[]
  updatedAt: string
  nextAt: string | null
  nextEndsAt: string | null
}
type Full = Item & {
  descriptionFr: Doc
  descriptionEn: Doc
  locationKind: 'temple' | 'other'
  locationFr: string
  locationEn: string
  registrationUrl: string | null
  coverMediaId: string | null
}
type Draft = Pick<
  Full,
  | 'titleFr'
  | 'titleEn'
  | 'descriptionFr'
  | 'descriptionEn'
  | 'startsAt'
  | 'endsAt'
  | 'allDay'
  | 'timezone'
  | 'recurrence'
  | 'exceptions'
  | 'locationKind'
  | 'locationFr'
  | 'locationEn'
  | 'registrationUrl'
  | 'coverMediaId'
  | 'groupId'
  | 'featured'
  | 'kind'
  | 'slug'
>
type CalItem = {
  id: string
  title: string
  status: Status
  date: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  cancelled: boolean
  moved: boolean
  recurring: boolean
  kind: string
}

const k = (key: string) => `events.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
const TZ = 'Africa/Douala'

/* ── Local date helpers (in the event's own zone) ─────────────────────── */
const p2 = (n: number) => String(n).padStart(2, '0')
const toInput = (iso: string, tz: string, allDay: boolean) => {
  const p = localParts(new Date(iso), tz)
  const d = `${p.y}-${p2(p.m)}-${p2(p.d)}`
  return allDay ? d : `${d}T${p2(p.hh)}:${p2(p.mm)}`
}
const fromInput = (v: string, tz: string, allDay: boolean): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(v)
  if (!m) return null
  const [y, mo, d, hh, mm] = [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
  ]
  return (
    allDay ? new Date(Date.UTC(y, mo - 1, d)) : zonedToUtc(y, mo, d, hh, mm, tz)
  ).toISOString()
}

export default function EventsPage() {
  const [openId, setOpenId] = useState<string | null>(() => location.hash.slice(1) || null)
  useEffect(() => {
    const onHash = () => setOpenId(location.hash.slice(1) || null)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const open = (id: string | null) => {
    history.replaceState(null, '', id ? `#${id}` : location.pathname + location.search)
    setOpenId(id)
  }
  return openId ? (
    <Editor id={openId} onBack={() => open(null)} onOpen={open} />
  ) : (
    <Home onOpen={open} />
  )
}

/* ── List + calendar ──────────────────────────────────────────────────── */
const kindOf = (k: string) =>
  EVENT_KIND_STYLE[(k as EventKind) in EVENT_KIND_STYLE ? (k as EventKind) : 'autre']
const KindTile = ({ kind }: { kind: string }) => (
  <span className="kind-tile" data-tone={kindOf(kind).tone} aria-hidden="true">
    <Icon name={kindOf(kind).icon as IconName} size={20} />
  </span>
)

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/events', { method: 'POST', body: {} }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['events'] })
      onOpen(r.id)
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle
            value={view}
            onChange={setView}
            label={t(k('title'))}
            options={[
              { id: 'list', label: t(k('view_list')), icon: 'layoutList' },
              { id: 'calendar', label: t(k('view_calendar')), icon: 'calendar' },
            ]}
          />
          {hasPermission(me, 'events:edit') && (
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              {t(k('write'))}
            </Button>
          )}
        </div>
      </header>
      {view === 'list' ? (
        <List onOpen={onOpen} onCreate={() => create.mutate()} locale={locale} />
      ) : (
        <MonthView onOpen={onOpen} />
      )}
    </div>
  )
}

function List({
  onOpen,
  onCreate,
  locale,
}: {
  onOpen: (id: string) => void
  onCreate: () => void
  locale: 'fr' | 'en'
}) {
  const { t } = useLocale()
  const me = useMe().data
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  const list = useQuery({
    queryKey: ['events', params.toString()],
    queryFn: () => api<{ items: Item[]; counts: Record<Status, number> }>(`/events?${params}`),
  })
  const counts = list.data?.counts
  // Grouped by the week of the next date (events with no date left go last), earliest week first.
  const groups = useMemo(() => {
    const items = list.data?.items ?? []
    const map = new Map<string, Item[]>()
    for (const e of items) {
      const key = e.nextAt
        ? weekOf(
            new Intl.DateTimeFormat('en-CA', { timeZone: e.allDay ? 'UTC' : TZ }).format(
              new Date(e.nextAt),
            ),
          ).from
        : 'past'
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === 'past' ? 1 : b === 'past' ? -1 : a.localeCompare(b),
    )
  }, [list.data])
  const when = (e: Item) => {
    const at = e.nextAt ?? e.startsAt
    const day = shortDate(at, locale, e.allDay ? 'UTC' : TZ)
    const time = e.allDay
      ? ''
      : ` · ${new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(at))}`
    const span = spanDays(at, e.nextEndsAt ?? (e.nextAt ? null : e.endsAt), e.allDay, TZ)
    return span.to !== span.from
      ? `${day} → ${shortDate(`${span.to}T12:00:00Z`, locale, 'UTC')}`
      : `${day}${time}`
  }
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <TextField
            label={t(k('search'))}
            placeholder={t(k('search_ph'))}
            icon="search"
            type="search"
            value={q}
            onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
          />
        </div>
        <div className="media-select">
          <SelectField
            label={t(k('filter'))}
            value={status || 'all'}
            onValueChange={(v) => setStatus(!v || v === 'all' ? '' : v)}
            options={[
              { value: 'all', label: t(k('all')) },
              ...(['draft', 'scheduled', 'published', 'archived'] as const).map((s) => ({
                value: s,
                label: `${t(`content.status.${s}`)}${counts ? ` (${counts[s]})` : ''}`,
              })),
            ]}
          />
        </div>
      </div>
      {list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={t(k(q || status ? 'empty_filter_t' : 'empty_t'))}
          text={t(k(q || status ? 'empty_filter_p' : 'empty_p'))}
        >
          {!q && !status && hasPermission(me, 'events:edit') && (
            <Button onClick={onCreate}>{t(k('write'))}</Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-5">
          {groups.map(([week, items]) => (
            <section
              key={week}
              className="grid gap-2"
              aria-label={week === 'past' ? t(k('no_next')) : weekLabel(week, locale)}
            >
              <h2 className="week-head">
                {week === 'past' ? t(k('no_next')) : weekLabel(week, locale)}
              </h2>
              <ul className="grid gap-2">
                {items.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="admin-row news-row"
                      onClick={() => onOpen(e.id)}
                    >
                      <span className="flex items-center gap-3 text-start">
                        <KindTile kind={e.kind} />
                        <span className="grid">
                          <strong>{e.titleFr || t(k('untitled'))}</strong>
                          <span className="text-sm text-ink-muted">
                            {when(e)}
                            {e.recurrence ? ` · ${t(k('repeats'))}` : ''}
                            {e.groupName ? ` · ${e.groupName}` : ''}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {e.featured && <Badge tone="gold">{t(k('featured'))}</Badge>}
                        <StatusBadge status={e.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function MonthView({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const now = new Date()
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [day, setDay] = useState<string>(todayKey)
  const first = new Date(Date.UTC(ym.y, ym.m, 1))
  const lead = (first.getUTCDay() + 6) % 7 // Monday first
  const gridStart = new Date(Date.UTC(ym.y, ym.m, 1 - lead))
  const gridEnd = new Date(gridStart.getTime() + 42 * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const cal = useQuery({
    queryKey: ['events', 'calendar', iso(gridStart)],
    queryFn: () =>
      api<{ items: CalItem[] }>(`/events/calendar?from=${iso(gridStart)}&to=${iso(gridEnd)}`),
  })
  // An event covering several days appears on each of them.
  const byDay = useMemo(() => {
    const map = new Map<string, (CalItem & { first: boolean; last: boolean })[]>()
    for (const it of cal.data?.items ?? []) {
      const span = spanDays(it.startsAt, it.endsAt, it.allDay, TZ)
      for (const d of daysBetween(span.from, span.to))
        map.set(d, [...(map.get(d) ?? []), { ...it, first: d === span.from, last: d === span.to }])
    }
    return map
  }, [cal.data])
  const monthName = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(first)
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 5 + i)),
    ),
  )
  const timeOf = (it: CalItem) =>
    it.allDay
      ? ''
      : new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: TZ,
        }).format(new Date(it.startsAt))
  const shift = (n: number) =>
    setYm((c) => ({ y: c.y + Math.floor((c.m + n) / 12), m: (c.m + n + 12) % 12 }))
  const selected = byDay.get(day) ?? []
  return (
    <div className="mcal-layout">
      <div className="admin-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl capitalize">{monthName}</h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => shift(-1)}
              aria-label={t(k('prev_month'))}
            >
              <Icon name="chevronLeft" size={20} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setYm({ y: now.getFullYear(), m: now.getMonth() })
                setDay(todayKey)
              }}
            >
              {t(k('today'))}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => shift(1)}
              aria-label={t(k('next_month'))}
            >
              <span className="mcal-flip">
                <Icon name="chevronLeft" size={20} />
              </span>
            </Button>
          </div>
        </div>
        <div className="mcal">
          {weekdays.map((w, i) => (
            <div
              key={w}
              className="mcal-head"
              data-sunday={i === 6 ? '' : undefined}
              aria-hidden="true"
            >
              {w}
            </div>
          ))}
          {Array.from({ length: 42 }, (_, i) => {
            const d = new Date(gridStart.getTime() + i * 86_400_000)
            const key = iso(d)
            const items = byDay.get(key) ?? []
            return (
              <button
                key={key}
                type="button"
                className="mcal-day"
                data-out={d.getUTCMonth() !== ym.m ? '' : undefined}
                data-today={key === todayKey ? '' : undefined}
                data-sunday={d.getUTCDay() === 0 ? '' : undefined}
                aria-pressed={day === key}
                aria-label={`${shortDate(d, locale, 'UTC')}${items.length ? `, ${items.length}` : ''}`}
                onClick={() => setDay(key)}
              >
                <span className="mcal-num">{d.getUTCDate()}</span>
                <span className="mcal-chips">
                  {items.slice(0, 3).map((it) => (
                    <span
                      key={`${it.id}-${it.startsAt}`}
                      className="mcal-chip"
                      data-status={it.status}
                      data-cancelled={it.cancelled ? '' : undefined}
                      data-cont={!it.first ? '' : undefined}
                    >
                      {it.first ? `${timeOf(it)} ${it.title}` : `↳ ${it.title}`}
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="mcal-more">
                      {t(k('more'), { n: String(items.length - 3) })}
                    </span>
                  )}
                </span>
                {items.length > 0 && (
                  <span className="mcal-dots" aria-hidden="true">
                    {'•'.repeat(Math.min(items.length, 3))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <aside className="admin-panel mcal-side" aria-live="polite">
        <h3 className="text-lg">{shortDate(`${day}T12:00:00Z`, locale, 'UTC')}</h3>
        {selected.length === 0 && <p className="text-ink-muted">{t(k('day_empty'))}</p>}
        <ul className="grid gap-2">
          {selected.map((it) => (
            <li key={`${it.id}-${it.startsAt}`}>
              <button type="button" className="admin-row news-row" onClick={() => onOpen(it.id)}>
                <span className="flex items-center gap-3 text-start">
                  <KindTile kind={it.kind} />
                  <span className="grid">
                    <strong data-struck={it.cancelled ? '' : undefined}>{it.title}</strong>
                    <span className="text-sm text-ink-muted">
                      {timeOf(it) || t(k('all_day'))}
                      {!it.first ? ` · ${t(k('continues'))}` : ''}
                      {it.cancelled ? ` · ${t(k('cancelled'))}` : ''}
                      {it.moved ? ` · ${t(k('moved'))}` : ''}
                    </span>
                  </span>
                </span>
                <StatusBadge status={it.status} />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

/* ── Editor ───────────────────────────────────────────────────────────── */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const

function Editor({ id, onBack }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const saved = useRef<Draft | null>(null)
  const [meta, setMeta] = useState<Item | null>(null)
  const [dialog, setDialog] = useState<
    null | 'publish' | 'versions' | 'delete' | 'archive' | 'unpublish'
  >(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const [note, setNote] = useState('')
  const canPublish = hasPermission(me, 'events:publish')
  const canEdit = hasPermission(me, 'events:edit')
  const canDelete = hasPermission(me, 'events:delete')

  const load = async () => {
    const r = await api<Full>(`/events/${id}`)
    const d: Draft = {
      titleFr: r.titleFr,
      titleEn: r.titleEn,
      descriptionFr: r.descriptionFr,
      descriptionEn: r.descriptionEn,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      allDay: r.allDay,
      timezone: r.timezone,
      recurrence: r.recurrence,
      exceptions: r.exceptions,
      locationKind: r.locationKind,
      locationFr: r.locationFr,
      locationEn: r.locationEn,
      registrationUrl: r.registrationUrl,
      coverMediaId: r.coverMediaId,
      groupId: r.groupId,
      featured: r.featured,
      kind: r.kind,
      slug: r.slug,
    }
    saved.current = d
    setDraft(d)
    setMeta(r)
    autosave.reset(d)
  }
  const autosave = useAutosave<Draft>(draft, async (v) => {
    const before = saved.current
    const patch: Record<string, unknown> = {}
    for (const key of Object.keys(v) as (keyof Draft)[])
      if (!before || JSON.stringify(v[key]) !== JSON.stringify(before[key])) patch[key] = v[key]
    if (Object.keys(patch).length === 0) return
    if (patch.registrationUrl === '') patch.registrationUrl = null
    const r = await api<{ slug: string }>(`/events/${id}`, { method: 'PATCH', body: patch })
    saved.current = { ...v, slug: r.slug }
    setDraft((d) => (d && d.slug !== r.slug ? { ...d, slug: r.slug } : d))
    qc.invalidateQueries({ queryKey: ['events'] })
  })
  useEffect(() => {
    load().catch(() => {
      say(t(k('error')), 'danger')
      onBack()
    })
    // biome-ignore lint/correctness/useExhaustiveDependencies: load once per event
  }, [id])

  const act = useMutation({
    mutationFn: async (a: { path: string; body?: unknown; done: string }) => {
      await autosave.flush()
      await api(`/events/${id}/${a.path}`, { method: 'POST', body: a.body ?? {} })
      return a.done
    },
    onSuccess: async (done) => {
      setDialog(null)
      say(t(k(done)))
      await load()
      qc.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('deleted')))
      qc.invalidateQueries({ queryKey: ['events'] })
      onBack()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const duplicate = useMutation({
    mutationFn: async () => {
      await autosave.flush()
      return api<{ id: string }>(`/events/${id}/duplicate`, { method: 'POST', body: {} })
    },
    onSuccess: (r) => {
      say(t(k('duplicated')))
      qc.invalidateQueries({ queryKey: ['events'] })
      history.replaceState(null, '', `#${r.id}`)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const preview = useMutation({
    mutationFn: async () => {
      await autosave.flush()
      return api<{ token: string }>(`/events/${id}/preview`, { method: 'POST', body: {} })
    },
    onSuccess: async ({ token }) => {
      const url = `${location.origin}/${locale}/${locale === 'fr' ? 'agenda/evenements/apercu' : 'calendar/events/preview'}/?t=${token}`
      await navigator.clipboard?.writeText(url).catch(() => {})
      say(t(k('preview_copied')))
      window.open(url, '_blank', 'noopener')
    },
  })
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () =>
      api<{ groups: { id: string; nameFr: string; nameEn: string | null }[] }>('/groups'),
    retry: false,
  })

  const upcoming = useMemo(() => {
    if (!draft) return []
    const from = new Date(Date.now() - 86_400_000)
    return expandOccurrences(
      {
        startsAt: new Date(draft.startsAt),
        endsAt: draft.endsAt ? new Date(draft.endsAt) : null,
        allDay: draft.allDay,
        timezone: draft.timezone,
        recurrence: draft.recurrence,
        exceptions: draft.exceptions,
      },
      from,
      new Date(Date.now() + 200 * 86_400_000),
    ).slice(0, 10)
  }, [draft])

  if (!draft || !meta) return <div className="admin-panel" aria-busy="true" />
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  const live = meta.status === 'published'
  const tz = draft.timezone
  const problems = publishProblems({
    title: draft.titleFr,
    bodyEmpty: false,
    publishAt: null,
    unpublishAt: null,
  })
  const clock = (iso: string, zone: string) =>
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(
      new Date(iso),
    )
  const fmt = (iso: string) => `${shortDate(iso, locale, TZ)} · ${clock(iso, TZ)}`
  const fmtOcc = (iso: string) =>
    draft.allDay
      ? shortDate(iso, locale, 'UTC')
      : `${shortDate(iso, locale, tz)} · ${clock(iso, tz)}`
  const siteUrl = `/${locale}/${locale === 'fr' ? 'agenda/evenements' : 'calendar/events'}/${draft.slug}/`
  const endBad = draft.endsAt !== null && draft.endsAt < draft.startsAt
  const r = draft.recurrence
  const repeatKind = !r
    ? 'none'
    : r.freq === 'weekly'
      ? 'weekly'
      : 'mode' in r && r.mode === 'nthWeekday'
        ? 'nth'
        : 'day'
  const setRepeat = (kind: string) => {
    const s = localParts(new Date(draft.startsAt), tz)
    const wd = new Date(Date.UTC(s.y, s.m - 1, s.d)).getUTCDay() as 0
    if (kind === 'none') set('recurrence', null)
    if (kind === 'weekly') set('recurrence', { freq: 'weekly', byDay: [wd] })
    if (kind === 'nth')
      set('recurrence', {
        freq: 'monthly',
        mode: 'nthWeekday',
        nth: Math.min(4, Math.ceil(s.d / 7)) as 1,
        weekday: wd,
      })
    if (kind === 'day') set('recurrence', { freq: 'monthly', mode: 'monthday', day: s.d })
  }
  const patchRec = (p: Partial<Recurrence>) =>
    draft.recurrence && set('recurrence', { ...draft.recurrence, ...p } as Recurrence)
  const endKind = !r ? 'never' : r.until ? 'until' : r.count ? 'count' : 'never'
  const setException = (e: Exception | null, date: string) =>
    set('exceptions', [...draft.exceptions.filter((x) => x.date !== date), ...(e ? [e] : [])])

  const textTab = (lang: 'Fr' | 'En') => (
    <div className="grid gap-4">
      {lang === 'En' && <p className="text-sm text-ink-muted">{t(k('en_note'))}</p>}
      <TextField
        label={t(k('title_label'))}
        placeholder={t(k('title_ph'))}
        value={lang === 'Fr' ? draft.titleFr : draft.titleEn}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) => set(`title${lang}`, e.target.value)}
      />
      <div className="grid gap-1">
        <span className="field-label">{t(k('desc_label'))}</span>
        <Suspense fallback={<div className="rte rte-loading" aria-busy="true" />}>
          <RichTextEditor
            key={lang}
            value={(lang === 'Fr' ? draft.descriptionFr : draft.descriptionEn) ?? EMPTY_DOC}
            label={t(k('desc_label'))}
            placeholder={t(k('desc_ph'))}
            onChange={(doc) => set(`description${lang}`, doc)}
          />
        </Suspense>
      </div>
      <TextField
        label={t(k('place_text'))}
        placeholder={t(k('place_ph'))}
        value={lang === 'Fr' ? draft.locationFr : draft.locationEn}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) => set(`location${lang}`, e.target.value)}
      />
    </div>
  )

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => autosave.flush().finally(onBack)}>
          <Icon name="chevronLeft" size={20} />
          {t(k('back'))}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={autosave.state} />
          <StatusBadge status={meta.status} />
        </div>
      </div>

      <div className="news-editor">
        <div className="grid gap-6">
          <div className="admin-panel">
            <TabsBox
              tabs={[
                { id: 'fr', label: t(k('lang_fr')), content: textTab('Fr') },
                { id: 'en', label: t(k('lang_en')), content: textTab('En') },
              ]}
            />
          </div>

          <div className="admin-panel">
            <h2 className="text-xl">{t(k('when'))}</h2>
            <SwitchField
              label={t(k('all_day'))}
              checked={draft.allDay}
              onCheckedChange={(v: boolean) => {
                set('allDay', v)
                // The end changes meaning: a last day (inclusive) instead of an end time.
                set('endsAt', null)
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="field-label">{t(k(draft.allDay ? 'date' : 'starts'))}</span>
                <input
                  className="input"
                  type={draft.allDay ? 'date' : 'datetime-local'}
                  value={toInput(draft.startsAt, tz, draft.allDay)}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const iso = fromInput(e.target.value, tz, draft.allDay)
                    if (iso) set('startsAt', iso)
                  }}
                />
              </label>
              {
                <label className="grid gap-1">
                  <span className="field-label">{t(k(draft.allDay ? 'last_day' : 'ends'))}</span>
                  <input
                    className="input"
                    type={draft.allDay ? 'date' : 'datetime-local'}
                    value={draft.endsAt ? toInput(draft.endsAt, tz, draft.allDay) : ''}
                    disabled={!canEdit}
                    aria-invalid={endBad}
                    onChange={(e) =>
                      set(
                        'endsAt',
                        e.target.value ? fromInput(e.target.value, tz, draft.allDay) : null,
                      )
                    }
                  />
                  {endBad && (
                    <span className="field-error" role="alert">
                      {t(k('end_before'))}
                    </span>
                  )}
                </label>
              }
            </div>

            <SelectField
              label={t(k('repeat'))}
              value={repeatKind}
              onValueChange={(v) => v && setRepeat(v)}
              options={[
                { value: 'none', label: t(k('repeat_none')) },
                { value: 'weekly', label: t(k('repeat_weekly')) },
                { value: 'nth', label: t(k('repeat_nth')) },
                { value: 'day', label: t(k('repeat_day')) },
              ]}
            />
            {r?.freq === 'weekly' && (
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <span className="field-label">{t(k('on_days'))}</span>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((wd) => (
                      <button
                        key={wd}
                        type="button"
                        className="chip"
                        aria-pressed={r.byDay.includes(wd)}
                        onClick={() => {
                          const days = r.byDay.includes(wd)
                            ? r.byDay.filter((x) => x !== wd)
                            : [...r.byDay, wd]
                          if (days.length) patchRec({ byDay: days })
                        }}
                      >
                        {new Intl.DateTimeFormat(locale, {
                          weekday: 'short',
                          timeZone: 'UTC',
                        }).format(new Date(Date.UTC(2026, 0, 4 + wd)))}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid max-w-40 gap-1">
                  <span className="field-label">
                    {t(k('every'))} ({t(k('every_weeks'))})
                  </span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={12}
                    value={r.interval ?? 1}
                    onChange={(e) =>
                      patchRec({ interval: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })
                    }
                  />
                </label>
              </div>
            )}
            {r?.freq === 'monthly' && 'mode' in r && r.mode === 'nthWeekday' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label={t(k('nth'))}
                  value={String(r.nth)}
                  onValueChange={(v) => v && patchRec({ nth: Number(v) as 1 })}
                  options={[1, 2, 3, 4, -1].map((n) => ({
                    value: String(n),
                    label: t(k(n === -1 ? 'nth_last' : `nth_${n}`)),
                  }))}
                />
                <SelectField
                  label={t(k('weekday'))}
                  value={String(r.weekday)}
                  onValueChange={(v) => v && patchRec({ weekday: Number(v) as 0 })}
                  options={WEEKDAYS.map((wd) => ({
                    value: String(wd),
                    label: new Intl.DateTimeFormat(locale, {
                      weekday: 'long',
                      timeZone: 'UTC',
                    }).format(new Date(Date.UTC(2026, 0, 4 + wd))),
                  }))}
                />
              </div>
            )}
            {r?.freq === 'monthly' && 'mode' in r && r.mode === 'monthday' && (
              <label className="grid max-w-40 gap-1">
                <span className="field-label">{t(k('day_of_month'))}</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={31}
                  value={r.day}
                  onChange={(e) =>
                    patchRec({ day: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })
                  }
                />
              </label>
            )}
            {r && (
              <div className="grid gap-3">
                <SelectField
                  label={t(k('end_never'))}
                  value={endKind}
                  onValueChange={(v) => {
                    if (v === 'never') patchRec({ until: null, count: null })
                    if (v === 'until')
                      patchRec({ until: toInput(draft.startsAt, tz, true), count: null })
                    if (v === 'count') patchRec({ until: null, count: 10 })
                  }}
                  options={[
                    { value: 'never', label: t(k('end_never')) },
                    { value: 'until', label: t(k('end_until')) },
                    { value: 'count', label: t(k('end_count')) },
                  ]}
                />
                {endKind === 'until' && (
                  <input
                    className="input max-w-56"
                    type="date"
                    aria-label={t(k('end_until'))}
                    value={r.until ?? ''}
                    onChange={(e) => e.target.value && patchRec({ until: e.target.value })}
                  />
                )}
                {endKind === 'count' && (
                  <label className="grid max-w-40 gap-1">
                    <span className="field-label">{t(k('count'))}</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={1000}
                      value={r.count ?? 10}
                      onChange={(e) =>
                        patchRec({ count: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="admin-panel">
            <h2 className="text-xl">{t(k('dates_t'))}</h2>
            <p className="text-sm text-ink-muted">{t(k('dates_help'))}</p>
            {upcoming.length === 0 && <p className="text-ink-muted">{t(k('no_dates'))}</p>}
            <ul className="grid gap-2">
              {upcoming.map((o) => {
                const exc = draft.exceptions.find((x) => x.date === o.date)
                return (
                  <li key={o.date} className="admin-row">
                    <span className="grid">
                      <strong data-struck={o.cancelled ? '' : undefined}>
                        {fmtOcc(o.startsAt.toISOString())}
                      </strong>
                      <span className="text-sm text-ink-muted">
                        {o.cancelled ? t(k('cancelled')) : o.moved ? t(k('moved')) : ''}
                        {exc?.noteFr ? ` · ${exc.noteFr}` : ''}
                      </span>
                    </span>
                    {canPublish && (
                      <span className="flex flex-wrap gap-2">
                        {exc ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setException(null, o.date)}
                          >
                            {t(k('restore_date'))}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setException(
                                  {
                                    date: o.date,
                                    kind: 'cancelled',
                                    ...(note ? { noteFr: note } : {}),
                                  },
                                  o.date,
                                )
                              }
                            >
                              {t(k('cancel_date'))}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setMoving(o.date)
                                setMoveTo(toInput(o.startsAt.toISOString(), tz, draft.allDay))
                              }}
                            >
                              {t(k('move_date'))}
                            </Button>
                          </>
                        )}
                      </span>
                    )}
                    {moving === o.date && (
                      <span className="flex w-full flex-wrap items-end gap-2">
                        <label className="grid gap-1">
                          <span className="field-label">{t(k('move_to'))}</span>
                          <input
                            className="input"
                            type={draft.allDay ? 'date' : 'datetime-local'}
                            value={moveTo}
                            onChange={(e) => setMoveTo(e.target.value)}
                          />
                        </label>
                        <Button
                          size="sm"
                          onClick={() => {
                            const iso = fromInput(moveTo, tz, draft.allDay)
                            if (!iso) return
                            setException(
                              {
                                date: o.date,
                                kind: 'moved',
                                startsAt: iso,
                                ...(note ? { noteFr: note } : {}),
                              },
                              o.date,
                            )
                            setMoving(null)
                          }}
                        >
                          {t(k('move_apply'))}
                        </Button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {canPublish && (
              <TextField
                label={t(k('note'))}
                placeholder={t(k('note_ph'))}
                value={note}
                onChange={(e: { target: { value: string } }) => setNote(e.target.value)}
              />
            )}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="admin-panel">
            <h2 className="text-lg">{t(k('status'))}</h2>
            <p className="text-sm text-ink-muted">
              {meta.status === 'scheduled' && meta.publishAt
                ? t(k('scheduled_for'), { date: fmt(meta.publishAt) })
                : live
                  ? `${t(k('live_since'))}${meta.unpublishAt ? ` ${t(k('until'), { date: fmt(meta.unpublishAt) })}` : ''}`
                  : t(`content.status.${meta.status}`)}
            </p>
            <div className="flex flex-wrap gap-2">
              {canPublish && meta.status !== 'archived' && (
                <Button onClick={() => setDialog('publish')}>
                  {t(k(live || meta.status === 'scheduled' ? 'change_dates' : 'publish'))}
                </Button>
              )}
              {canPublish && (live || meta.status === 'scheduled') && (
                <Button variant="secondary" onClick={() => setDialog('unpublish')}>
                  {t(k('unpublish'))}
                </Button>
              )}
              {canPublish && meta.status === 'archived' && (
                <Button
                  variant="secondary"
                  onClick={() => act.mutate({ path: 'unpublish', done: 'unpublished' })}
                >
                  {t(k('unpublish'))}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={preview.isPending}
                onClick={() => preview.mutate()}
              >
                {t(k('preview'))}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDialog('versions')}>
                {t(k('versions'))}
              </Button>
              {canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={duplicate.isPending}
                  onClick={() => duplicate.mutate()}
                >
                  {t(k('duplicate'))}
                </Button>
              )}
              {live && (
                <a className="btn btn-ghost btn-sm" href={siteUrl} target="_blank" rel="noreferrer">
                  {t(k('view_site'))}
                </a>
              )}
            </div>
            <p className="text-xs text-ink-muted">{t(k('preview_help'))}</p>
          </div>

          <div className="admin-panel">
            <SelectField
              label={t(k('kind'))}
              value={draft.kind}
              onValueChange={(v) => v && set('kind', v as EventKind)}
              options={EVENT_KINDS.map((x) => ({ value: x, label: t(k(`kind_${x}`)) }))}
            />
            <SelectField
              label={t(k('place'))}
              value={draft.locationKind}
              onValueChange={(v) => v && set('locationKind', v as 'temple' | 'other')}
              options={[
                { value: 'temple', label: t(k('place_temple')) },
                { value: 'other', label: t(k('place_other')) },
              ]}
            />
            <CoverField mediaId={draft.coverMediaId} onChange={(v) => set('coverMediaId', v)} />
            {groups.data && (
              <SelectField
                label={t(k('side_group'))}
                value={draft.groupId ?? 'none'}
                onValueChange={(v) => set('groupId', !v || v === 'none' ? null : v)}
                options={[
                  { value: 'none', label: t(k('group_all')) },
                  ...groups.data.groups.map((g) => ({
                    value: g.id,
                    label: locale === 'en' && g.nameEn ? g.nameEn : g.nameFr,
                  })),
                ]}
              />
            )}
            <TextField
              label={t(k('link'))}
              hint={t(k('link_help'))}
              placeholder="https://"
              value={draft.registrationUrl ?? ''}
              disabled={!canEdit}
              onChange={(e: { target: { value: string } }) =>
                set('registrationUrl', e.target.value || null)
              }
            />
            <TextField
              label={t(k('side_slug'))}
              placeholder={t(k('side_slug_ph'))}
              value={draft.slug}
              disabled={!canEdit}
              onChange={(e: { target: { value: string } }) => set('slug', e.target.value)}
            />
            <SwitchField
              label={t(k('side_feature'))}
              checked={draft.featured}
              onCheckedChange={(v: boolean) => set('featured', v)}
            />
          </div>

          <div className="admin-panel">
            {canPublish && meta.status !== 'archived' && (
              <Button variant="secondary" onClick={() => setDialog('archive')}>
                {t(k('archive'))}
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setDialog('delete')}>
                {t(k('delete'))}
              </Button>
            )}
          </div>
        </aside>
      </div>

      <PublishDialog
        key={`${meta.publishAt}-${meta.unpublishAt}-${dialog}`}
        open={dialog === 'publish'}
        onClose={() => setDialog(null)}
        live={live || meta.status === 'scheduled'}
        busy={act.isPending}
        problems={problems}
        initial={{
          publishAt: meta.status === 'scheduled' ? meta.publishAt : null,
          unpublishAt: meta.unpublishAt,
        }}
        onConfirm={(c) =>
          act.mutate({
            path: 'publish',
            body: c,
            done: c.publishAt && new Date(c.publishAt) > new Date() ? 'scheduled' : 'published',
          })
        }
      />
      <RevisionsDrawer
        open={dialog === 'versions'}
        onClose={() => setDialog(null)}
        base={`/events/${id}`}
        onRestored={async () => {
          say(t(k('restored')))
          await autosave.flush()
          await load()
        }}
      />
      <ConfirmDialog
        open={dialog === 'unpublish'}
        onClose={() => setDialog(null)}
        title={t(k('unpublish_t'))}
        text={t(k('unpublish_p'))}
        confirmLabel={t(k('unpublish'))}
        busy={act.isPending}
        onConfirm={() => act.mutate({ path: 'unpublish', done: 'unpublished' })}
      />
      <ConfirmDialog
        open={dialog === 'archive'}
        onClose={() => setDialog(null)}
        title={t(k('archive_t'))}
        text={t(k('archive_p'))}
        confirmLabel={t(k('archive'))}
        busy={act.isPending}
        onConfirm={() => act.mutate({ path: 'archive', done: 'archived' })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={t(k('delete_t'))}
        text={t(k('delete_p'))}
        confirmLabel={t(k('delete'))}
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
