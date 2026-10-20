import { useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { formatDate } from '@eec/i18n'
import { TabsBox } from '@eec/ui/react'
import { type AuditEntry, useDashboardData } from '../lib/dashboard'

/** Which kinds of activity each tab shows (entity types written by the API's audit calls). */
const TABS: { id: string; label: MessageKey; types: string[] | null }[] = [
  { id: 'all', label: 'dash.tab_all', types: null },
  { id: 'people', label: 'dash.tab_people', types: ['user', 'role', 'group'] },
  { id: 'members', label: 'dash.tab_members', types: ['account', 'members'] },
  { id: 'media', label: 'dash.tab_media', types: ['media'] },
  { id: 'settings', label: 'dash.tab_settings', types: ['settings', 'flag', 'outbox'] },
]

/** Recent activity from the different areas, one tab each (for people who may read the activity log). */
export function RecentActivity() {
  const { t, locale } = useLocale()
  const { audit } = useDashboardData()
  if (!audit.data) return null
  const entries = audit.data.entries
  const list = (items: AuditEntry[]) =>
    items.length ? (
      <ul className="activity-list">
        {items.slice(0, 6).map((e) => (
          <li key={e.id}>
            <span className="activity-when">{formatDate(new Date(e.createdAt), locale)}</span>
            <span className="activity-who">{e.actorName ?? '—'}</span>
            <span>{locale === 'en' ? (e.summaryEn ?? e.summaryFr) : e.summaryFr}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-ink-muted">{t('dash.no_activity')}</p>
    )
  return (
    <section className="stat-card" aria-labelledby="activity-title">
      <h2 id="activity-title" className="text-2xl">
        {t('dash.recent')}
      </h2>
      <TabsBox
        tabs={TABS.map((tab) => ({
          id: tab.id,
          label: t(tab.label),
          content: list(
            tab.types ? entries.filter((e) => tab.types?.includes(e.entityType)) : entries,
          ),
        }))}
      />
    </section>
  )
}
