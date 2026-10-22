import { api, useLocale } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, EmptyState, Icon, TextField } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Illustration } from '../../components/Illustration'
import { fmt, Gate, notify, PageHeader } from '../../components/kit'

export const Route = createFileRoute('/_app/validate')({
  component: () => (
    <Gate permission="core:validation-read">
      <Validate />
    </Gate>
  ),
})

type Review = {
  id: string
  kind: 'correction' | 'note'
  body: string
  author: string | null
  createdAt: string
}
type Priority = 'high' | 'medium' | 'low'
type Item = {
  priority: Priority
  id: string
  kind: 'settings' | 'schedule' | 'page_slot'
  group: { fr: string; en: string }
  fieldKey?: string
  label?: { fr: string; en: string }
  value: string
  adminPath: string
  publicPath: { fr: string; en: string } | null
  canApprove: boolean
  reviews: Review[]
}

const PRIORITIES: Priority[] = ['high', 'medium', 'low']
const PRIO = {
  high: { icon: 'alert', tone: 'danger' },
  medium: { icon: 'clock', tone: 'warning' },
  low: { icon: 'info', tone: 'info' },
} as const

function Validate() {
  const { t, locale } = useLocale()
  const q = useQuery({
    queryKey: ['validation'],
    queryFn: () => api<{ items: Item[] }>('/validation'),
  })
  const items = q.data?.items ?? []
  // The API sorts by priority: groups appear by their most urgent item.
  const groups = [...new Set(items.map((i) => i.group[locale]))]
  const count = (p: Priority) => items.filter((i) => i.priority === p).length
  return (
    <div className="grid gap-6">
      <PageHeader title={t('admin.validate.title')} lead={t('admin.validate.lead')} />
      {items.length > 0 && (
        <p className="flex flex-wrap items-center gap-2" role="status">
          {PRIORITIES.map((p) => (
            <span key={p} className={`prio prio-${p}`} data-n={count(p)}>
              <Icon name={PRIO[p].icon} size={16} />
              {t('admin.validate.prio_count', {
                n: String(count(p)),
                label: t(`admin.validate.prio_${p}` as MessageKey),
              })}
            </span>
          ))}
        </p>
      )}
      {q.data && items.length === 0 ? (
        <EmptyState
          title={t('admin.validate.empty_title')}
          text={t('admin.validate.empty_text')}
          art={<Illustration name="reading-book" />}
        />
      ) : (
        groups.map((g) => (
          <section key={g} className="grid gap-3" aria-label={g}>
            <h2 className="text-xl">{g}</h2>
            <ul className="grid gap-3">
              {items
                .filter((i) => i.group[locale] === g)
                .map((i) => (
                  <ItemCard key={i.id} item={i} />
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function ItemCard({ item }: { item: Item }) {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const [mode, setMode] = useState<null | 'correction' | 'note'>(null)
  const [text, setText] = useState('')
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['validation'] })
    qc.invalidateQueries({ queryKey: ['validation-count'] })
  }
  const label =
    item.label?.[locale] ??
    t(`settings.fields.${item.fieldKey}.label` as MessageKey) ??
    item.fieldKey
  const approve = useMutation({
    mutationFn: () => api('/validation/approve', { body: { id: item.id } }),
    onSuccess: () => {
      refresh()
      notify(t('admin.validate.approved'))
    },
    onError: () => notify(t('admin.validate.approve_error'), { tone: 'danger' }),
  })
  const send = useMutation({
    mutationFn: () =>
      api('/validation/comment', { body: { id: item.id, kind: mode, body: text.trim() } }),
    onSuccess: () => {
      setMode(null)
      setText('')
      refresh()
      notify(t('admin.validate.sent'))
    },
    onError: () => notify(t('admin.validate.send_error'), { tone: 'danger' }),
  })
  const resolve = useMutation({
    mutationFn: (id: string) => api(`/validation/reviews/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => {
      refresh()
      notify(t('admin.validate.resolved'))
    },
  })
  return (
    <li className="admin-panel grid gap-3" data-priority={item.priority}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <span className={`prio prio-${item.priority}`}>
            <Icon name={PRIO[item.priority].icon} size={16} />
            {t(`admin.validate.prio_${item.priority}` as MessageKey)}
          </span>
          <h3 className="text-lg">{label}</h3>
          <p className="text-sm text-ink-muted">{t('admin.validate.current')}</p>
          <p className="max-w-[70ch] whitespace-pre-line font-medium">{item.value}</p>
        </div>
        {item.reviews.length > 0 && (
          <Badge>
            {t('admin.validate.corrections')} · {item.reviews.length}
          </Badge>
        )}
      </div>
      {item.reviews.length > 0 && (
        <ul className="grid gap-2" aria-label={t('admin.validate.corrections')}>
          {item.reviews.map((r) => (
            <li key={r.id} className="grid gap-1 rounded-lg bg-surface-2 p-3">
              <p className="text-sm text-ink-muted">
                {t(`admin.validate.kind_${r.kind}` as MessageKey)}
                {r.author ? ` · ${t('admin.validate.by', { name: r.author })}` : ''} ·{' '}
                {fmt(r.createdAt, locale)}
              </p>
              <p>{r.body}</p>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={resolve.isPending}
                  onClick={() => resolve.mutate(r.id)}
                >
                  {t('admin.validate.resolve')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {mode && (
        <div className="grid gap-2">
          <TextField
            label={t('admin.validate.write')}
            hint={t('admin.validate.write_help')}
            placeholder=""
            textarea
            maxLength={600}
            value={text}
            onChange={(e: { target: { value: string } }) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              loading={send.isPending}
              disabled={text.trim().length < 2}
              onClick={() => send.mutate()}
            >
              {t('admin.validate.send')}
            </Button>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {t('admin.validate.cancel')}
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {item.canApprove ? (
          <Button loading={approve.isPending} onClick={() => approve.mutate()}>
            <Icon name="check" />
            {t('admin.validate.approve')}
          </Button>
        ) : (
          <span className="text-sm text-ink-muted">{t('admin.validate.cannot')}</span>
        )}
        <Button variant="secondary" onClick={() => setMode('correction')}>
          {t('admin.validate.ask')}
        </Button>
        <Button variant="ghost" onClick={() => setMode('note')}>
          {t('admin.validate.note')}
        </Button>
        <Link
          className="btn btn-ghost"
          to="/m/$module"
          params={{ module: item.adminPath.replace('/m/', '') }}
        >
          {t('admin.validate.open')}
        </Link>
        {item.publicPath && (
          <a
            className="btn btn-ghost"
            href={`/${item.publicPath[locale]}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('admin.validate.see_public')}
            <Icon name="external" size={16} />
          </a>
        )}
      </div>
    </li>
  )
}
