import { Popover } from '@base-ui/react/popover'
import { api, useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Icon } from './Icon'

type Item = {
  id: string
  kind: string
  params: {
    date?: string
    what?: 'attendance' | 'offerings' | 'both'
    count?: number
    reports?: number
    reviews?: number
    entries?: number
  }
  href: string
  weekOf: string
  read: boolean
  resolved: boolean
}
type Feed = { items: Item[]; unread: number }
const k = (key: string) => `admin.notifications.${key}` as MessageKey

/** The summary of the week first, then what to validate, then what to fill in. */
const RANK = (kind: string) =>
  ['week_nudge', 'sunday_review', 'campaign_review'].indexOf(kind) >= 0
    ? ['week_nudge', 'sunday_review', 'campaign_review'].indexOf(kind)
    : 3
const DAY = 86_400_000
const monday = (d: Date) => new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY)
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** The bell in the top bar: the person's notifications, grouped by week, each with a deep link (decision 0044). */
export function NotificationsBell() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(true)
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Feed>('/notifications'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] })
  const read = useMutation({
    mutationFn: (body: { ids?: string[]; all?: boolean }) =>
      api('/notifications/read', { method: 'POST', body }),
    onSuccess: refresh,
  })
  const dismiss = useMutation({
    mutationFn: (id: string) =>
      api('/notifications/dismiss', { method: 'POST', body: { ids: [id] } }),
    onSuccess: refresh,
  })
  const unread = q.data?.unread ?? 0
  const items = (q.data?.items ?? []).filter((n) => !onlyUnread || (!n.read && !n.resolved))
  const day = (d: string, style: 'short' | 'long' = 'long') =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: style,
      timeZone: 'UTC',
    }).format(new Date(`${d}T12:00:00Z`))
  const thisWeek = iso(monday(new Date()))
  const lastWeek = iso(new Date(Date.parse(`${thisWeek}T12:00:00Z`) - 7 * DAY))
  const weekTitle = (w: string) =>
    w === thisWeek
      ? t(k('this_week'))
      : w === lastWeek
        ? t(k('last_week'))
        : t(k('week_of'), {
            from: day(w, 'short'),
            to: day(iso(new Date(Date.parse(`${w}T12:00:00Z`) + 6 * DAY)), 'short'),
          })
  const weeks = [
    ...items.reduce(
      (m, n) => m.set(n.weekOf, [...(m.get(n.weekOf) ?? []), n]),
      new Map<string, Item[]>(),
    ),
  ]
  const go = (n: Item) => {
    if (!n.read) read.mutate({ ids: [n.id] })
    setOpen(false)
    const [to, hash] = n.href.split('#')
    navigate({ to: to as never, hash }).then(() =>
      // Already on that screen: the hash alone changes, and the screen listens for it.
      window.dispatchEvent(new HashChangeEvent('hashchange')),
    )
  }
  // Each kind writes its own words; nothing but the kind and its numbers is stored.
  const title = (n: Item) => {
    const date = day(n.params.date ?? n.weekOf)
    if (n.kind === 'sunday_review') return t(k(n.resolved ? 'review_done_t' : 'review_t'), { date })
    if (n.kind === 'campaign_review')
      return t(k(n.resolved ? 'campaign_done_t' : 'campaign_t'), {
        n: String(n.params.count ?? 0),
      })
    if (n.kind === 'week_nudge')
      return t(k(n.resolved ? 'nudge_done_t' : 'nudge_t'), {
        n: String((n.params.reports ?? 0) + (n.params.reviews ?? 0) + (n.params.entries ?? 0)),
      })
    return t(k(n.resolved ? 'sunday_done_t' : 'sunday_due_t'), { date })
  }
  const detail = (n: Item) => {
    if (n.resolved) return t(k('done'))
    if (n.kind === 'sunday_review') return t(k(`review_${n.params.what ?? 'both'}`))
    if (n.kind === 'campaign_review') return t(k('campaign_p'))
    if (n.kind === 'week_nudge')
      return t(k('nudge_p'), {
        reports: String(n.params.reports ?? 0),
        reviews: String(n.params.reviews ?? 0),
        entries: String(n.params.entries ?? 0),
      })
    return t(k(`what_${n.params.what ?? 'both'}`))
  }
  const icon = (n: Item) =>
    n.resolved
      ? 'check'
      : n.kind === 'week_nudge'
        ? 'clock'
        : n.kind === 'campaign_review'
          ? 'gift'
          : n.kind === 'sunday_review'
            ? 'shield'
            : 'notebook'
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="btn btn-ghost btn-icon notif-btn"
        aria-label={unread ? t(k('open_n'), { n: String(unread) }) : t(k('open'))}
        data-tip={open ? undefined : t(k('open'))}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span className="notif-count" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="eec-positioner">
          <Popover.Popup className="eec-popover eec-popup notif-pop">
            <div className="notif-head">
              <Popover.Title className="text-lg">{t(k('title'))}</Popover.Title>
              {unread > 0 && (
                <button
                  type="button"
                  className="notif-link"
                  onClick={() => read.mutate({ all: true })}
                >
                  {t(k('mark_all'))}
                </button>
              )}
            </div>
            <div className="notif-filter">
              {([true, false] as const).map((only) => (
                <button
                  key={String(only)}
                  type="button"
                  aria-pressed={onlyUnread === only}
                  onClick={() => setOnlyUnread(only)}
                >
                  {t(k(only ? 'unread' : 'all'))}
                </button>
              ))}
            </div>
            {q.isPending ? (
              <div className="notif-empty" aria-busy="true">
                <span className="text-sm text-ink-muted">{t(k('loading'))}</span>
              </div>
            ) : weeks.length === 0 ? (
              <div className="notif-empty">
                <strong>{t(k('empty_t'))}</strong>
                <span className="text-sm text-ink-muted">
                  {t(k(onlyUnread ? 'empty_unread' : 'empty_p'))}
                </span>
              </div>
            ) : (
              weeks.map(([w, list]) => (
                <section key={w} aria-label={weekTitle(w)}>
                  <h3 className="notif-week">{weekTitle(w)}</h3>
                  <ul className="notif-list">
                    {[...list]
                      .sort((a, b) => RANK(a.kind) - RANK(b.kind))
                      .map((n) => (
                        <li key={n.id} data-unread={!n.read && !n.resolved} data-done={n.resolved}>
                          <button type="button" className="notif-item" onClick={() => go(n)}>
                            <span className="notif-ico" aria-hidden="true">
                              <Icon name={icon(n)} size={20} />
                            </span>
                            <span className="grid gap-0.5 text-start">
                              <strong>{title(n)}</strong>
                              <span className="text-sm text-ink-muted">{detail(n)}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="notif-x"
                            aria-label={t(k('dismiss'))}
                            data-tip={t(k('dismiss'))}
                            onClick={() => dismiss.mutate(n.id)}
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </li>
                      ))}
                  </ul>
                </section>
              ))
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
