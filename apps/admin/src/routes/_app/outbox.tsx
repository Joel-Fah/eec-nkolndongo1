import { api, useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Button, EmptyState } from '@eec/ui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Illustration } from '../../components/Illustration'
import { CopyLink, fmt, Gate, notify, PageHeader } from '../../components/kit'

export const Route = createFileRoute('/_app/outbox')({
  component: () => (
    <Gate permission="core:system-outbox">
      <Outbox />
    </Gate>
  ),
})

type Message = {
  id: string
  toEmail: string
  template: string
  payload: { url?: string; phone?: string; firstName?: string; form?: string; code?: string }
  createdAt: string
  status: string
}
const TABS = ['pending', 'relayed', 'dismissed'] as const

function Outbox() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending')
  const list = useQuery({
    queryKey: ['outbox', tab],
    queryFn: () => api<{ messages: Message[] }>(`/outbox?status=${tab}`),
  })
  const mark = (m: Message, status: 'relayed' | 'dismissed') =>
    api(`/outbox/${m.id}`, { body: { status } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['outbox'] })
        notify(
          t(status === 'relayed' ? 'admin.outbox.done_relayed' : 'admin.outbox.done_dismissed'),
        )
      })
      .catch(() => notify(t('admin.common.error'), { tone: 'danger' }))
  const templateName = (k: string) =>
    ['password-reset', 'invitation', 'registration-promoted'].includes(k)
      ? t(`admin.outbox.templates.${k}` as MessageKey)
      : k
  return (
    <div className="grid gap-6">
      <PageHeader title={t('admin.outbox.title')} lead={t('admin.outbox.lead')} />
      <div className="tabs-list" role="tablist" aria-label={t('admin.outbox.title')}>
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
          >
            {t(`admin.outbox.tabs.${s}` as MessageKey)}
          </button>
        ))}
      </div>
      {list.data && list.data.messages.length === 0 ? (
        <EmptyState
          title={t('admin.outbox.empty_title')}
          text={t('admin.outbox.empty_text')}
          art={<Illustration name="reading-book" />}
        />
      ) : (
        <ul className="grid gap-4">
          {(list.data?.messages ?? []).map((m) => (
            <li key={m.id} className="admin-panel">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">{templateName(m.template)}</h2>
                <span className="text-sm text-ink-muted">{fmt(m.createdAt, locale)}</span>
              </div>
              <p className="flex flex-wrap gap-2">
                <span className="text-ink-muted">{t('admin.outbox.to')}</span>
                <span className="font-medium">{m.toEmail || m.payload.firstName}</span>
                {m.payload.phone && (
                  <a href={`tel:${m.payload.phone}`} className="font-medium">
                    {m.payload.phone}
                  </a>
                )}
              </p>
              {m.template === 'registration-promoted' && (
                <p className="text-sm text-ink-muted">
                  {t('admin.outbox.registration_note', {
                    form: m.payload.form ?? '',
                    code: m.payload.code ?? '',
                  })}
                </p>
              )}
              {m.payload.url && tab === 'pending' && (
                <CopyLink url={m.payload.url} note={t('admin.outbox.link')} />
              )}
              {tab === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => mark(m, 'relayed')}>{t('admin.outbox.relayed')}</Button>
                  <Button variant="ghost" onClick={() => mark(m, 'dismissed')}>
                    {t('admin.outbox.dismiss')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
