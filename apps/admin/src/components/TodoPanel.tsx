import { api, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Card } from '@eec/ui/react'
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
}
type Row = {
  key: string
  text: MessageKey
  n: number
  module: string
  vars?: Record<string, string>
}

/** « À faire »: what is waiting for this person (their drafts, what goes live this week, gaps, new messages). */
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
  const dates = (d.emptySundays ?? [])
    .map((s) =>
      new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
        new Date(`${s}T00:00:00Z`),
      ),
    )
    .join(', ')
  const rows = (
    [
      { key: 'msg', text: 'dash.todo_messages', n: d.newMessages ?? 0, module: 'contact' },
      { key: 'dn', text: 'dash.todo_drafts_news', n: d.drafts?.news ?? 0, module: 'news' },
      { key: 'de', text: 'dash.todo_drafts_events', n: d.drafts?.events ?? 0, module: 'events' },
      { key: 'dg', text: 'dash.todo_drafts_guides', n: d.drafts?.guides ?? 0, module: 'guides' },
      { key: 'sn', text: 'dash.todo_scheduled_news', n: d.scheduled?.news ?? 0, module: 'news' },
      {
        key: 'se',
        text: 'dash.todo_scheduled_events',
        n: d.scheduled?.events ?? 0,
        module: 'events',
      },
      {
        key: 'es',
        text: 'dash.todo_empty_sundays',
        n: d.emptySundays?.length ?? 0,
        module: 'liturgy',
        vars: { dates },
      },
      { key: 'sl', text: 'dash.todo_slots', n: d.unvalidatedSlots ?? 0, module: 'schedule' },
      { key: 'mn', text: 'dash.todo_missing_en_news', n: d.missingEn?.news ?? 0, module: 'news' },
      {
        key: 'me',
        text: 'dash.todo_missing_en_events',
        n: d.missingEn?.events ?? 0,
        module: 'events',
      },
      {
        key: 'mg',
        text: 'dash.todo_missing_en_guides',
        n: d.missingEn?.guides ?? 0,
        module: 'guides',
      },
    ] as Row[]
  ).filter((r) => r.n > 0)
  if (rows.length === 0) return null
  return (
    <Card>
      <h2 className="text-xl">{t('dash.todo_title')}</h2>
      <ul className="grid gap-1">
        {rows.map((r) => (
          <li key={r.key}>
            <Link to="/m/$module" params={{ module: r.module }} className="admin-dash-link">
              <Icon name="check" size={16} />
              {t(r.text as MessageKey, { n: String(r.n), ...(r.vars ?? {}) })}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
