import { api, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Button, EmptyState, SelectField, TextField } from '@eec/ui/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Illustration } from '../../components/Illustration'
import { fmt, Gate, PageHeader } from '../../components/kit'

export const Route = createFileRoute('/_app/audit')({
  component: () => (
    <Gate permission="core:audit-read">
      <Audit />
    </Gate>
  ),
})

type Entry = {
  id: string
  createdAt: string
  action: string
  entityType: string
  summaryFr: string
  summaryEn: string | null
  diff: unknown
  actorName: string | null
  actorEmail: string | null
}
/** A diff as readable lines: nested keys joined with " › ", values as plain text. */
function flatten(value: unknown, prefix = ''): [string, string][] {
  if (value === null || value === undefined) return prefix ? [[prefix, '—']] : []
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== 'object' || v === null))
      return [[prefix || '·', value.join(', ') || '—']]
    return value.flatMap((v, i) => flatten(v, `${prefix}${prefix ? ' › ' : ''}${i + 1}`))
  }
  if (typeof value === 'object')
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, prefix ? `${prefix} › ${k}` : k),
    )
  return [[prefix || '·', String(value)]]
}

const ENTITIES = [
  'user',
  'role',
  'group',
  'settings',
  'invitation',
  'account',
  'outbox',
  'module',
  'audit',
] as const

function Audit() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const [entity, setEntity] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const params = new URLSearchParams(Object.entries({ entity, from, to }).filter(([, v]) => v))
  const log = useInfiniteQuery({
    queryKey: ['audit', entity, from, to],
    initialPageParam: '' as string,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams(params)
      if (pageParam) p.set('before', pageParam)
      return api<{ entries: Entry[]; next: string | null }>(`/audit?${p}`)
    },
    getNextPageParam: (last) => last.next ?? undefined,
  })
  const entries = log.data?.pages.flatMap((p) => p.entries) ?? []
  const filtered = !!(entity || from || to)
  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('admin.audit.title')}
        lead={t('admin.audit.lead')}
        actions={
          me?.isSuperAdmin && (
            <a className="btn btn-secondary" href={`/api/audit/export.csv?${params}`} download>
              {t('admin.audit.export')}
            </a>
          )
        }
      />
      <div className="admin-filters">
        <SelectField
          label={t('admin.audit.filter_entity')}
          value={entity || '__all'}
          onValueChange={(v) => setEntity(v && v !== '__all' ? v : '')}
          options={[
            { value: '__all', label: t('admin.common.all') },
            ...ENTITIES.map((e) => ({
              value: e,
              label: t(`admin.audit.entities.${e}` as MessageKey),
            })),
          ]}
        />
        <TextField
          label={t('admin.audit.from')}
          placeholder="AAAA-MM-JJ"
          type="date"
          value={from}
          onChange={(e: { target: { value: string } }) => setFrom(e.target.value)}
        />
        <TextField
          label={t('admin.audit.to')}
          placeholder="AAAA-MM-JJ"
          type="date"
          value={to}
          onChange={(e: { target: { value: string } }) => setTo(e.target.value)}
        />
      </div>
      {log.data && entries.length === 0 ? (
        <EmptyState
          title={filtered ? t('admin.common.empty_filtered') : t('admin.audit.empty_title')}
          text={filtered ? undefined : t('admin.audit.empty_text')}
          art={<Illustration name="reading-book" />}
        />
      ) : (
        <ol className="grid gap-2">
          {entries.map((e) => (
            <li key={e.id} className="admin-log">
              <div className="admin-log-line">
                <span className="font-medium">
                  {locale === 'en' ? (e.summaryEn ?? e.summaryFr) : e.summaryFr}
                </span>
                <span className="text-sm text-ink-muted">
                  {e.actorName ?? t('admin.audit.system')} · {fmt(e.createdAt, locale)}{' '}
                  {new Date(e.createdAt).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {e.diff != null && (
                <details className="admin-log-details">
                  <summary>{t('admin.audit.details')}</summary>
                  <dl className="admin-diff">
                    {flatten(e.diff).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
      {log.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            loading={log.isFetchingNextPage}
            onClick={() => log.fetchNextPage()}
          >
            {t('admin.common.more')}
          </Button>
        </div>
      )}
    </div>
  )
}
