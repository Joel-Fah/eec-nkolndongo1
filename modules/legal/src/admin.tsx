/**
 * Documents légaux (admin, /m/legal): the privacy policy, the legal notice and the credits, each in versions. A new
 * version is a draft (a copy of the latest) until published; publishing a new privacy policy tells members what changed
 * and, only when the purposes changed, asks them to accept again. A published version is never edited.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { GuardedDialog } from '@eec/content-kit'
import { type Doc, EMPTY_DOC } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, CheckboxField, TabsBox, TextField, toastManager } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'

const RichTextEditor = lazy(() => import('@eec/content-kit/editor'))
const k = (key: string) => `legal.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })
const KEYS = ['privacy', 'mentions', 'credits'] as const

type Row = {
  id: string
  docKey: string
  version: number
  label: string
  state: 'draft' | 'published'
  purposeChanged: boolean
  summaryFr: string
  publishedAt: string | null
  updatedAt: string
}
type Version = Row & { bodyFr: Doc; bodyEn: Doc; summaryEn: string }

export default function LegalPage() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canUpdate = hasPermission(me, 'legal:update')
  const [editing, setEditing] = useState<string | null>(null)
  const list = useQuery({ queryKey: ['legal'], queryFn: () => api<{ items: Row[] }>('/legal') })
  const items = list.data?.items ?? []
  const create = useMutation({
    mutationFn: (key: string) =>
      api<{ version: Row }>(`/legal/${key}/versions`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['legal'] })
      setEditing(r.version.id)
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const day = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso)) : ''
  return (
    <div className="grid gap-6">
      <header className="grid max-w-[62ch] gap-2">
        <h1 className="text-4xl">{t(k('title'))}</h1>
        <p className="text-ink-muted">{t(k('lead'))}</p>
      </header>
      {KEYS.map((key) => {
        const versions = items.filter((i) => i.docKey === key)
        const published = versions.find((v) => v.state === 'published')
        const draft = versions.find((v) => v.state === 'draft')
        return (
          <section key={key} className="admin-panel grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl">{t(k(`doc_${key}`))}</h2>
              <span className="flex flex-wrap items-center gap-2">
                {published ? (
                  <Badge tone="success">{t(k('current'), { label: published.label })}</Badge>
                ) : (
                  <Badge>{t(k('none'))}</Badge>
                )}
                {draft && (
                  <Badge tone="warning">{t(k('draft_open'), { label: draft.label })}</Badge>
                )}
              </span>
            </div>
            {published && (
              <p className="text-sm text-ink-muted">
                {t(k('published_on'), { date: day(published.publishedAt) })}
                {published.summaryFr ? ` — ${published.summaryFr}` : ''}
              </p>
            )}
            {canUpdate && (
              <div>
                {draft ? (
                  <Button variant="secondary" onClick={() => setEditing(draft.id)}>
                    {t(k('continue'))}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    loading={create.isPending}
                    onClick={() => create.mutate(key)}
                  >
                    {t(k('new_version'))}
                  </Button>
                )}
              </div>
            )}
            {versions.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="admin-row">
                    <span>
                      {v.label}
                      {v.purposeChanged ? ` · ${t(k('purpose_changed'))}` : ''}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-ink-muted">
                        {v.state === 'published' ? day(v.publishedAt) : t(k('status_draft'))}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(v.id)}>
                        {t(k(v.state === 'draft' ? 'edit' : 'view'))}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {editing && <VersionEditor id={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function VersionEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canUpdate = hasPermission(me, 'legal:update')
  const canPublish = hasPermission(me, 'legal:publish')
  const q = useQuery({
    queryKey: ['legal-version', id],
    queryFn: () => api<{ version: Version }>(`/legal/versions/${id}`),
  })
  const [body, setBody] = useState<{ bodyFr: Doc; bodyEn: Doc } | null>(null)
  const [initial, setInitial] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [sum, setSum] = useState({ summaryFr: '', summaryEn: '', purposeChanged: false })
  useEffect(() => {
    if (q.data && !body) {
      const b = {
        bodyFr: q.data.version.bodyFr ?? EMPTY_DOC,
        bodyEn: q.data.version.bodyEn ?? EMPTY_DOC,
      }
      setBody(b)
      setInitial(JSON.stringify(b))
    }
  }, [q.data, body])
  const v = q.data?.version
  const editable = v?.state === 'draft' && canUpdate
  const dirty = !!body && JSON.stringify(body) !== initial
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['legal'] })
    qc.invalidateQueries({ queryKey: ['legal-version', id] })
  }
  const save = useMutation({
    mutationFn: () => api(`/legal/versions/${id}`, { method: 'PUT', body }),
    onSuccess: () => {
      setInitial(JSON.stringify(body))
      refresh()
      notify(t(k('saved')))
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await save.mutateAsync()
      return api(`/legal/versions/${id}/publish`, { method: 'POST', body: sum })
    },
    onSuccess: () => {
      refresh()
      notify(t(k('published')))
      onClose()
    },
    onError: () => notify(t(k('publish_error')), 'error'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/legal/versions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh()
      onClose()
    },
  })
  const pane = (lang: 'Fr' | 'En') =>
    body && (
      <Suspense fallback={<div className="rte-loading" />}>
        <RichTextEditor
          key={lang}
          value={body[`body${lang}`]}
          label={v?.label ?? ''}
          docTitle={v ? t(k(`doc_${v.docKey}`)) : ''}
          docFallback=""
          placeholder=""
          onChange={(doc: Doc) => setBody((b) => b && { ...b, [`body${lang}`]: doc })}
        />
      </Suspense>
    )
  return (
    <GuardedDialog open onClose={onClose} dirty={dirty || publishing} wide title={v?.label ?? ''}>
      {(requestClose) => (
        <div className="dialog-body">
          <h2 className="dialog-title">{v ? `${t(k(`doc_${v.docKey}`))} — ${v.label}` : ''}</h2>
          {v?.state === 'published' && (
            <p className="text-sm text-ink-muted">{t(k('read_only'))}</p>
          )}
          {body && (
            <TabsBox
              tabs={[
                { id: 'fr', label: t(k('lang_fr')), content: pane('Fr') },
                { id: 'en', label: t(k('lang_en')), content: pane('En') },
              ]}
            />
          )}
          {publishing && v && (
            <div className="admin-panel grid gap-3">
              <h3 className="text-lg">{t(k('publish_t'))}</h3>
              <p className="text-sm text-ink-muted">
                {t(k(v.docKey === 'privacy' ? 'publish_help_privacy' : 'publish_help'))}
              </p>
              {v.docKey === 'privacy' && (
                <>
                  <TextField
                    label={`${t(k('summary'))} (FR)`}
                    placeholder={t(k('summary_ph'))}
                    textarea
                    maxLength={600}
                    value={sum.summaryFr}
                    onChange={(e: { target: { value: string } }) =>
                      setSum({ ...sum, summaryFr: e.target.value })
                    }
                  />
                  <TextField
                    label={`${t(k('summary'))} (EN)`}
                    placeholder=""
                    textarea
                    maxLength={600}
                    value={sum.summaryEn}
                    onChange={(e: { target: { value: string } }) =>
                      setSum({ ...sum, summaryEn: e.target.value })
                    }
                  />
                  <CheckboxField
                    label={t(k('purpose_box'))}
                    checked={sum.purposeChanged}
                    onCheckedChange={(c: boolean) => setSum({ ...sum, purposeChanged: c })}
                  />
                  <p className="text-sm text-ink-muted">{t(k('purpose_help'))}</p>
                </>
              )}
              <div className="flex gap-2">
                <Button loading={publish.isPending} onClick={() => publish.mutate()}>
                  {t(k('publish_now'))}
                </Button>
                <Button variant="secondary" onClick={() => setPublishing(false)}>
                  {t(k('cancel'))}
                </Button>
              </div>
            </div>
          )}
          <div className="dialog-actions">
            {editable && (
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                {t(k('delete_draft'))}
              </Button>
            )}
            <Button variant="secondary" onClick={requestClose}>
              {t(k('close'))}
            </Button>
            {editable && (
              <Button
                variant="secondary"
                loading={save.isPending}
                disabled={!dirty}
                onClick={() => save.mutate()}
              >
                {t(k('save'))}
              </Button>
            )}
            {editable && canPublish && !publishing && (
              <Button onClick={() => setPublishing(true)}>{t(k('publish'))}</Button>
            )}
          </div>
        </div>
      )}
    </GuardedDialog>
  )
}
