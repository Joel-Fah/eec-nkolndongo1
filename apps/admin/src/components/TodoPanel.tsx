import { api, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Icon } from './Icon'

type Todo = {
  drafts?: { news: number | null; events: number | null; guides: number | null }
  scheduled?: { news: number | null; events: number | null }
  missingEn?: { news: number | null; events: number | null; guides: number | null }
  emptySundays?: string[]
  unvalidatedSlots?: number
  newMessages?: number
  oldestMessageHours?: number
}
type Level = 'critical' | 'attention' | 'info'
type Item = {
  key: string
  text: `dash.todo_${string}`
  n: number
  module: string
  icon: IconName
  level: Level
  vars?: Record<string, string>
}
const LEVEL_ICON: Record<Level, IconName> = { critical: 'alert', attention: 'clock', info: 'info' }
const RANK: Record<Level, number> = { critical: 0, attention: 1, info: 2 }
const DAY = 86_400_000

/**
 * « À faire »: what is waiting for this person, as cards ranked by urgency — critical (red: a message waiting more than
 * two days, a Sunday within a week with no programme), needs attention (amber), good to know (blue) — each carrying the
 * icon of the screen it leads to.
 */
export function TodoPanel() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const q = useQuery({
    queryKey: ['todo'],
    queryFn: () => api<Todo>('/todo'),
    enabled: !!me,
    staleTime: 30_000,
  })
  const d = q.data
  if (!d) return null
  const next = d.emptySundays?.[0]
  const inDays = next
    ? Math.round((new Date(`${next}T00:00:00Z`).getTime() - Date.now()) / DAY)
    : 99
  const dates = (d.emptySundays ?? [])
    .map((x) =>
      new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
        new Date(`${x}T00:00:00Z`),
      ),
    )
    .join(', ')
  const items = (
    [
      {
        key: 'msg',
        text: 'dash.todo_messages',
        n: d.newMessages ?? 0,
        module: 'contact',
        icon: 'mail',
        level: (d.oldestMessageHours ?? 0) >= 48 ? 'critical' : 'attention',
      },
      {
        key: 'es',
        text: 'dash.todo_empty_sundays',
        n: d.emptySundays?.length ?? 0,
        module: 'liturgy',
        icon: 'book',
        level: inDays <= 7 ? 'critical' : 'attention',
        vars: { dates },
      },
      {
        key: 'sl',
        text: 'dash.todo_slots',
        n: d.unvalidatedSlots ?? 0,
        module: 'schedule',
        icon: 'clock',
        level: 'attention',
      },
      {
        key: 'sn',
        text: 'dash.todo_scheduled_news',
        n: d.scheduled?.news ?? 0,
        module: 'news',
        icon: 'newspaper',
        level: 'info',
      },
      {
        key: 'se',
        text: 'dash.todo_scheduled_events',
        n: d.scheduled?.events ?? 0,
        module: 'events',
        icon: 'calendar',
        level: 'info',
      },
      {
        key: 'dn',
        text: 'dash.todo_drafts_news',
        n: d.drafts?.news ?? 0,
        module: 'news',
        icon: 'newspaper',
        level: 'info',
      },
      {
        key: 'de',
        text: 'dash.todo_drafts_events',
        n: d.drafts?.events ?? 0,
        module: 'events',
        icon: 'calendar',
        level: 'info',
      },
      {
        key: 'dg',
        text: 'dash.todo_drafts_guides',
        n: d.drafts?.guides ?? 0,
        module: 'guides',
        icon: 'checklist',
        level: 'info',
      },
      {
        key: 'mn',
        text: 'dash.todo_missing_en_news',
        n: d.missingEn?.news ?? 0,
        module: 'news',
        icon: 'newspaper',
        level: 'info',
      },
      {
        key: 'me',
        text: 'dash.todo_missing_en_events',
        n: d.missingEn?.events ?? 0,
        module: 'events',
        icon: 'calendar',
        level: 'info',
      },
      {
        key: 'mg',
        text: 'dash.todo_missing_en_guides',
        n: d.missingEn?.guides ?? 0,
        module: 'guides',
        icon: 'checklist',
        level: 'info',
      },
    ] as Item[]
  )
    .filter((i) => i.n > 0)
    .sort((a, b) => RANK[a.level] - RANK[b.level])
  if (items.length === 0) return null
  const count = (l: Level) => items.filter((i) => i.level === l).length
  return (
    <section className="todo" aria-labelledby="todo-title">
      <header className="todo-head">
        <h2 id="todo-title" className="text-2xl">
          {t('dash.todo_title')}
        </h2>
        <p className="todo-legend">
          {(['critical', 'attention', 'info'] as Level[]).map((l) =>
            count(l) > 0 ? (
              <span key={l} className="todo-pill" data-level={l}>
                <Icon name={LEVEL_ICON[l]} size={16} />
                {count(l)} {t(`dash.todo_level_${l}` as MessageKey)}
              </span>
            ) : null,
          )}
        </p>
      </header>
      <ul className="todo-grid">
        {items.map((i) => (
          <li key={i.key}>
            <Link
              to="/m/$module"
              params={{ module: i.module }}
              className="todo-card"
              data-level={i.level}
            >
              <span className="todo-icon" aria-hidden="true">
                <Icon name={i.icon} size={24} />
              </span>
              <span className="todo-count">{i.n}</span>
              <span className="todo-text">
                {t(i.text as MessageKey, { n: String(i.n), ...(i.vars ?? {}) })}
              </span>
              <span className="todo-foot">
                <span className="todo-level">
                  <Icon name={LEVEL_ICON[i.level]} size={16} />
                  {t(`dash.todo_level_${i.level}` as MessageKey)}
                </span>
                <Icon name="arrowRight" size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
