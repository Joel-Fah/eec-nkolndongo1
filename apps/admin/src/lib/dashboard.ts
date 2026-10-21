import { api, hasPermission, useMe } from '@eec/admin-kit'
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
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      api<{ sections: Record<string, Record<string, { value: string; validated: boolean }>> }>(
        '/settings',
      ),
    enabled: hasPermission(me, 'settings:read'),
  })
  return { me, members, media, audit, outbox, settings }
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
  icon: 'mail' | 'photo' | 'shield' | 'users' | 'archive' | 'check'
  /** i18n key for the sentence; `n` is filled in. */
  text: string
  n?: number
  action: string
  to: '/outbox' | '/m/$module' | '/groups' | '/'
  params?: { module: string }
}

/**
 * Advice drawn from what is going on: things waiting for someone, things worth tidying. Only what the person can
 * act on appears; when nothing needs attention, one reassuring card says so.
 */
export function useInsights(): Insight[] {
  const { me, members, media, outbox, settings } = useDashboardData()
  const out: Insight[] = []
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
  if (settings.data) {
    const toApprove = Object.values(settings.data.sections).reduce(
      (n, sec) => n + Object.values(sec).filter((f) => f.value && !f.validated).length,
      0,
    )
    if (toApprove > 0 && hasPermission(me, 'settings:validate'))
      out.push({
        key: 'validate',
        icon: 'shield',
        text: 'dash.insight_validate',
        n: toApprove,
        action: 'dash.insight_validate_do',
        to: '/m/$module',
        params: { module: 'settings' },
      })
  }
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
  const loaded = !!(outbox.data || settings.data || media.data || members.data)
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
