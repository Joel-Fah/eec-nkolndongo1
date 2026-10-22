import { api, useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { fmt, Gate, notify, PageHeader } from '../../components/kit'

export const Route = createFileRoute('/_app/health')({
  component: () => (
    <Gate permission="core:system-health">
      <Health />
    </Gate>
  ),
})

type Level = 'ok' | 'warn' | 'fail'
type Check = { id: string; level: Level; value: number | null; limit?: number }
type Latest = { checkedAt: string; status: Level; checks: Check[] }

const TONE = { ok: 'success', warn: 'warning', fail: 'danger' } as const
const MB = 1024 * 1024

function size(bytes: number, locale: string) {
  const n = bytes / MB
  return new Intl.NumberFormat(locale, { maximumFractionDigits: n >= 1024 ? 1 : 0 })
    .format(n >= 1024 ? n / 1024 : n)
    .concat(n >= 1024 ? ' Go' : ' Mo')
}

function Health() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api<{ latest: Latest | null }>('/system-health'),
  })
  const run = useMutation({
    mutationFn: () => api<{ latest: Latest }>('/system-health/run', { method: 'POST' }),
    onSuccess: (d) => {
      qc.setQueryData(['system-health'], d)
    },
    onError: () => notify(t('admin.health.error'), { tone: 'danger' }),
  })
  const latest = q.data?.latest ?? null
  const phrase = (c: Check) => {
    const v = c.value
    switch (c.id) {
      case 'database':
        return t('admin.health.database_v', { n: String(v ?? '—') })
      case 'bucket':
        return t(c.level === 'ok' ? 'admin.health.bucket_ok' : 'admin.health.bucket_fail')
      case 'backup':
        return v === null
          ? t('admin.health.backup_none')
          : t('admin.health.backup_v', { n: String(v) })
      case 'outbox':
        return t('admin.health.outbox_v', { n: String(v ?? 0) })
      default:
        return t('admin.health.size_v', {
          used: size(v ?? 0, locale),
          limit: size(c.limit ?? 0, locale),
          pct: String(Math.round(((v ?? 0) / (c.limit || 1)) * 100)),
        })
    }
  }
  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('admin.health.title')}
        lead={t('admin.health.lead')}
        actions={
          <Button loading={run.isPending} onClick={() => run.mutate()}>
            {t(run.isPending ? 'admin.health.running' : 'admin.health.run')}
          </Button>
        }
      />
      {q.data && !latest && <p className="admin-panel">{t('admin.health.never')}</p>}
      {latest && (
        <>
          <p className="flex flex-wrap items-center gap-3" role="status">
            <Badge tone={TONE[latest.status]}>
              {t(`admin.health.status_${latest.status}` as MessageKey)}
            </Badge>
            <span className="text-sm text-ink-muted">
              {t('admin.health.last', { date: fmt(latest.checkedAt, locale) })}
            </span>
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {latest.checks.map((c) => (
              <li key={c.id} className="admin-panel" data-level={c.level}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg">{t(`admin.health.${c.id}` as MessageKey)}</h2>
                  <Badge tone={TONE[c.level]}>
                    {t(`admin.health.status_${c.level}` as MessageKey)}
                  </Badge>
                </div>
                <p className="font-medium">{phrase(c)}</p>
                {c.level !== 'ok' && (
                  <p className="text-sm text-ink-muted">
                    {t(`admin.health.help_${c.id}` as MessageKey)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <section className="admin-panel">
        <h2 className="text-lg">{t('admin.health.elsewhere_title')}</h2>
        <p className="text-ink-muted">{t('admin.health.elsewhere')}</p>
      </section>
    </div>
  )
}
