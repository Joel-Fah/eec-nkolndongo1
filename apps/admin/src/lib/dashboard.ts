import { api, hasPermission, useMe } from '@eec/admin-kit'
import type { IconName } from '@eec/ui/icons'
import { useQuery } from '@tanstack/react-query'

export type MemberStats = {
  total: number
  newThisMonth: number
  newsSubscribers: number
  previous: { total: number; newThisMonth: number; newsSubscribers: number }
  byGroup: { key: string; nameFr: string; nameEn: string | null; n: number }[]
  trend: { month: string; n: number }[]
}
export type MediaStats = {
  withoutAltEn: number
  unused: number
  files: number
  filesThisMonth: number
  filesLastMonth: number
  usedBytes: number
  quotaBytes: number
}
export type AuditEntry = {
  id: string
  createdAt: string
  entityType: string
  summaryFr: string
  summaryEn: string | null
  actorName: string | null
}

/** What the dashboard shows depends on what the person may see; each query runs only when allowed. */
export function useDashboardData() {
  const me = useMe().data
  const members = useQuery({
    queryKey: ['members-stats'],
    queryFn: () => api<MemberStats>('/members/stats'),
    enabled: hasPermission(me, 'members:read'),
  })
  const media = useQuery({
    queryKey: ['media-stats'],
    queryFn: () => api<MediaStats>('/media/stats'),
    enabled: hasPermission(me, 'media:read') && me?.modules.media !== false,
  })
  const audit = useQuery({
    queryKey: ['audit-recent'],
    queryFn: () => api<{ entries: AuditEntry[] }>('/audit'),
    enabled: hasPermission(me, 'core:audit-read'),
  })
  const outbox = useQuery({
    queryKey: ['outbox', 'pending'],
    queryFn: () => api<{ messages: unknown[] }>('/outbox'),
    enabled: hasPermission(me, 'core:system-outbox'),
  })
  const validation = useQuery({
    queryKey: ['validation-count'],
    queryFn: () => api<{ n: number; canApprove: number }>('/validation/count'),
    enabled: hasPermission(me, 'core:validation-read'),
  })
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api<{ latest: { status: 'ok' | 'warn' | 'fail' } | null }>('/system-health'),
    enabled: hasPermission(me, 'core:system-health'),
  })
  // What is waiting for this person (shared with « À faire »): requests from colleagues, join requests, cards, messages.
  const todo = useQuery({
    queryKey: ['todo'],
    queryFn: () => api<TodoCounts>('/todo'),
    enabled: !!me,
    staleTime: 30_000,
  })
  return { me, members, media, audit, outbox, validation, health, todo }
}

/** The part of `/todo` the insight cards read. */
export type TodoCounts = {
  drafts?: { news: number | null; events: number | null; guides: number | null }
  publishRequests?: { news: number; events: number }
  joinRequests?: number
  cardsToApprove?: number
  baptismsToConfirm?: number
  newMessages?: number
  emptySundays?: string[]
}

/** Change between two periods: direction and a rounded percentage (null when there is nothing to compare to). */
export function change(current: number, previous: number) {
  const diff = current - previous
  const direction: 'up' | 'down' | 'flat' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const percent = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : null
  return { direction, percent, diff }
}

export type Insight = {
  key: string
  icon: IconName
  /** i18n key for the sentence; `n` is filled in. */
  text: string
  n?: number
  action: string
  to: '/outbox' | '/validate' | '/health' | '/m/$module' | '/groups' | '/my-group' | '/'
  params?: { module: string }
}

/**
 * Advice drawn from what is going on: things waiting for someone, things worth tidying. Only what the person can
 * act on appears; when nothing needs attention, one reassuring card says so.
 */
export function useInsights(): Insight[] {
  const { me, members, media, outbox, validation, health, todo } = useDashboardData()
  const out: Insight[] = []
  const w = todo.data
  const module = (m: string) => ({ to: '/m/$module' as const, params: { module: m } })
  // What colleagues and the parish are waiting for this person to do comes first, whatever their role.
  if (w?.publishRequests?.news)
    out.push({
      key: 'req-news',
      icon: 'newspaper',
      text: 'dash.insight_req_news',
      n: w.publishRequests.news,
      action: 'dash.insight_req_do',
      ...module('news'),
    })
  if (w?.publishRequests?.events)
    out.push({
      key: 'req-events',
      icon: 'calendar',
      text: 'dash.insight_req_events',
      n: w.publishRequests.events,
      action: 'dash.insight_req_do',
      ...module('events'),
    })
  if (w?.joinRequests)
    out.push({
      key: 'join',
      icon: 'users',
      text: 'dash.insight_join',
      n: w.joinRequests,
      action: 'dash.insight_join_do',
      to: '/my-group',
    })
  if (w?.cardsToApprove)
    out.push({
      key: 'cards',
      icon: 'church',
      text: 'dash.insight_cards',
      n: w.cardsToApprove,
      action: 'dash.insight_cards_do',
      ...module('communion'),
    })
  if (w?.baptismsToConfirm)
    out.push({
      key: 'baptisms',
      icon: 'church',
      text: 'dash.insight_baptisms',
      n: w.baptismsToConfirm,
      action: 'dash.insight_baptisms_do',
      ...module('communion'),
    })
  if (w?.newMessages)
    out.push({
      key: 'messages',
      icon: 'mail',
      text: 'dash.insight_messages',
      n: w.newMessages,
      action: 'dash.insight_messages_do',
      ...module('contact'),
    })
  // Someone who writes but may not publish: their drafts are theirs to send for review.
  if (!hasPermission(me, 'news:publish') && w?.drafts?.news)
    out.push({
      key: 'drafts-news',
      icon: 'newspaper',
      text: 'dash.insight_drafts_news',
      n: w.drafts.news,
      action: 'dash.insight_drafts_do',
      ...module('news'),
    })
  if (!hasPermission(me, 'events:publish') && w?.drafts?.events)
    out.push({
      key: 'drafts-events',
      icon: 'calendar',
      text: 'dash.insight_drafts_events',
      n: w.drafts.events,
      action: 'dash.insight_drafts_do',
      ...module('events'),
    })
  const pending = outbox.data?.messages.length ?? 0
  if (pending > 0)
    out.push({
      key: 'outbox',
      icon: 'mail',
      text: 'dash.insight_outbox',
      n: pending,
      action: 'dash.insight_outbox_do',
      to: '/outbox',
    })
  if (health.data?.latest && health.data.latest.status !== 'ok')
    out.push({
      key: 'health',
      icon: 'shield',
      text: 'dash.insight_health',
      action: 'dash.insight_health_do',
      to: '/health',
    })
  if (validation.data && validation.data.n > 0)
    out.push({
      key: 'validate',
      icon: 'shield',
      text: 'dash.insight_validate',
      n: validation.data.n,
      action: 'dash.insight_validate_do',
      to: '/validate',
    })
  if (media.data) {
    if (media.data.withoutAltEn > 0)
      out.push({
        key: 'alt',
        icon: 'photo',
        text: 'dash.insight_alt',
        n: media.data.withoutAltEn,
        action: 'dash.insight_alt_do',
        to: '/m/$module',
        params: { module: 'media' },
      })
    if (media.data.usedBytes / media.data.quotaBytes >= 0.7)
      out.push({
        key: 'space',
        icon: 'archive',
        text: 'dash.insight_space',
        n: Math.round((media.data.usedBytes / media.data.quotaBytes) * 100),
        action: 'dash.insight_space_do',
        to: '/m/$module',
        params: { module: 'media' },
      })
  }
  if (members.data && members.data.byGroup.length === 0 && hasPermission(me, 'core:groups-manage'))
    out.push({
      key: 'groups',
      icon: 'users',
      text: 'dash.insight_groups',
      action: 'dash.insight_groups_do',
      to: '/groups',
    })
  const loaded = !!(outbox.data || validation.data || media.data || members.data || todo.data)
  if (loaded && out.length === 0)
    out.push({
      key: 'ok',
      icon: 'check',
      text: 'dash.insight_ok',
      action: 'dash.insight_ok_do',
      to: '/',
    })
  return out.slice(0, 4)
}
