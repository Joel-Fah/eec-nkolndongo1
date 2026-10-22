/**
 * Vie pratique (admin, /m/guides): guided paths for life events. Each guide has an intro and ordered steps (what to
 * do, the documents to bring, how long, who to contact). Only a published guide is public; the wording of the seeded
 * structure stays a draft until the content partner has validated it.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog, GuardedDialog } from '@eec/content-kit'
import { type Doc, EMPTY_DOC } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  SelectField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'

const RichTextEditor = lazy(() => import('@eec/content-kit/editor'))
const k = (key: string) => `guides.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })
const ICONS = ['checklist', 'couple', 'heart', 'users', 'church', 'book', 'home'] as const

type Step = {
  id?: string
  titleFr: string
  titleEn: string
  bodyFr: Doc
  bodyEn: Doc
  documentsFr: string
  documentsEn: string
  durationFr: string
  durationEn: string
  contactFr: string
  contactEn: string
}
type Guide = {
  id: string
  slug: string
  state: 'draft' | 'published'
  icon: (typeof ICONS)[number]
  sortOrder: number
  titleFr: string
  titleEn: string
  introFr: string
  introEn: string
  audienceFr: string
  audienceEn: string
  steps: Step[]
}
const blankStep = (): Step => ({
  titleFr: '',
  titleEn: '',
  bodyFr: EMPTY_DOC,
  bodyEn: EMPTY_DOC,
  documentsFr: '',
  documentsEn: '',
  durationFr: '',
  durationEn: '',
  contactFr: '',
  contactEn: '',
})

export default function GuidesPage() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'guides:edit')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const list = useQuery({
    queryKey: ['guides'],
    queryFn: () => api<{ items: Omit<Guide, 'steps'>[] }>('/guides'),
  })
  const create = useMutation({
    mutationFn: () =>
      api<{ guide: Guide }>('/guides', { method: 'POST', body: { titleFr: title } }),
    onSuccess: (r) => {
      setCreating(false)
      setTitle('')
      qc.invalidateQueries({ queryKey: ['guides'] })
      setOpenId(r.guide.id)
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const items = list.data?.items ?? []
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {canEdit && <Button onClick={() => setCreating(true)}>{t(k('add'))}</Button>}
      </header>
      {list.data && items.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
      ) : (
        <ul className="grid gap-2">
          {items.map((g) => (
            <li key={g.id} className="admin-row">
              <span className="flex items-center gap-3">
                <span className="kind-tile" data-tone="primary" aria-hidden="true">
                  <Icon name={g.icon as IconName} size={20} />
                </span>
                <span className="grid">
                  <strong>{(locale === 'en' && g.titleEn) || g.titleFr}</strong>
                  <span className="text-sm text-ink-muted">/{g.slug}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge>{t(k(`state_${g.state}`))}</Badge>
                <Button variant="secondary" size="sm" onClick={() => setOpenId(g.id)}>
                  {t(k('edit'))}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <GuardedDialog open={creating} onClose={() => setCreating(false)} dirty={!!title}>
        {(requestClose) => (
          <form
            className="dialog-body"
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim()) create.mutate()
            }}
          >
            <h2 className="dialog-title">{t(k('add'))}</h2>
            <TextField
              label={t(k('new_title'))}
              placeholder={t(k('new_title_ph'))}
              value={title}
              onChange={(e: { target: { value: string } }) => setTitle(e.target.value)}
            />
            <div className="dialog-actions">
              <Button variant="secondary" onClick={requestClose}>
                {t(k('cancel'))}
              </Button>
              <Button type="submit" loading={create.isPending}>
                {t(k('create'))}
              </Button>
            </div>
          </form>
        )}
      </GuardedDialog>
      {openId && <GuideEditor id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function GuideEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'guides:edit')
  const canPublish = hasPermission(me, 'guides:publish')
  const canDelete = hasPermission(me, 'guides:delete')
  const detail = useQuery({
    queryKey: ['guide', id],
    queryFn: () => api<{ guide: Guide }>(`/guides/${id}`),
  })
  const [draft, setDraft] = useState<Guide | null>(null)
  const [initial, setInitial] = useState('')
  const [open, setOpen] = useState(0)
  const [del, setDel] = useState(false)
  useEffect(() => {
    if (detail.data && !draft) {
      setDraft(detail.data.guide)
      setInitial(JSON.stringify(detail.data.guide))
    }
  }, [detail.data, draft])
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['guides'] })
    qc.invalidateQueries({ queryKey: ['guide', id] })
  }
  const save = useMutation({
    mutationFn: (g: Guide) =>
      api(`/guides/${id}`, {
        method: 'PUT',
        body: {
          titleFr: g.titleFr,
          titleEn: g.titleEn,
          introFr: g.introFr,
          introEn: g.introEn,
          audienceFr: g.audienceFr,
          audienceEn: g.audienceEn,
          icon: g.icon,
          steps: g.steps.map(({ id: _id, ...s }) => s),
        },
      }),
    onSuccess: (_d, g) => {
      setInitial(JSON.stringify(g))
      refresh()
      notify(t(k('saved')))
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const state = useMutation({
    mutationFn: async (to: 'publish' | 'unpublish') => {
      if (draft && JSON.stringify(draft) !== initial) await save.mutateAsync(draft)
      return api(`/guides/${id}/${to}`, { method: 'POST' })
    },
    onSuccess: (_d, to) => {
      const next = to === 'publish' ? 'published' : 'draft'
      setDraft((d) => (d ? { ...d, state: next } : d))
      setInitial((s) => s.replace(/"state":"\w+"/, `"state":"${next}"`))
      refresh()
      notify(t(k(to === 'publish' ? 'published' : 'unpublished')))
    },
    onError: () => notify(t(k('publish_error')), 'error'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/guides/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh()
      onClose()
    },
    onError: () => notify(t(k('delete_error')), 'error'),
  })
  const set = <K extends keyof Guide>(key: K, v: Guide[K]) =>
    setDraft((d) => (d ? { ...d, [key]: v } : d))
  const setStep = (i: number, p: Partial<Step>) =>
    setDraft((d) => d && { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) })
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d
      const steps = [...d.steps]
      const [s] = steps.splice(i, 1)
      steps.splice(i + by, 0, s as Step)
      setOpen(i + by)
      return { ...d, steps }
    })
  const dirty = !!draft && JSON.stringify(draft) !== initial
  const f = (
    key: 'title' | 'documents' | 'duration' | 'contact',
    lang: 'Fr' | 'En',
    i: number,
    label: string,
    ph: string,
    hint?: string,
  ) =>
    draft && (
      <TextField
        label={label}
        placeholder={ph}
        hint={hint}
        textarea={key === 'documents'}
        value={draft.steps[i]?.[`${key}${lang}` as keyof Step] as string}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) =>
          setStep(i, { [`${key}${lang}`]: e.target.value })
        }
      />
    )
  const stepPane = (s: Step, i: number, lang: 'Fr' | 'En') => (
    <div className="grid gap-3">
      {f('title', lang, i, t(k('step_title')), t(k('step_title_ph')))}
      <Suspense fallback={<div className="rte-loading" />}>
        <RichTextEditor
          key={`${i}-${lang}`}
          value={s[`body${lang}`]}
          label={t(k('step_body'))}
          docTitle={s[`title${lang}`]}
          docFallback={t(k('step_untitled'))}
          placeholder={t(k('step_body_ph'))}
          onChange={(doc: Doc) => setStep(i, { [`body${lang}`]: doc })}
        />
      </Suspense>
      {f('documents', lang, i, t(k('step_docs')), t(k('step_docs_ph')), t(k('step_docs_help')))}
      <div className="grid gap-3 sm:grid-cols-2">
        {f('duration', lang, i, t(k('step_duration')), t(k('step_duration_ph')))}
        {f('contact', lang, i, t(k('step_contact')), t(k('step_contact_ph')))}
      </div>
    </div>
  )
  return (
    <GuardedDialog open onClose={onClose} dirty={dirty} wide title={draft?.titleFr ?? ''}>
      {(requestClose) => (
        <div className="dialog-body">
          <h2 className="dialog-title">{draft?.titleFr}</h2>
          {!draft ? (
            <p className="text-ink-muted">…</p>
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={`${t(k('g_title'))} (FR)`}
                  placeholder={t(k('g_title_ph'))}
                  value={draft.titleFr}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => set('titleFr', e.target.value)}
                />
                <TextField
                  label={`${t(k('g_title'))} (EN)`}
                  placeholder=""
                  value={draft.titleEn}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => set('titleEn', e.target.value)}
                />
                <TextField
                  label={`${t(k('g_intro'))} (FR)`}
                  placeholder={t(k('g_intro_ph'))}
                  textarea
                  value={draft.introFr}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => set('introFr', e.target.value)}
                />
                <TextField
                  label={`${t(k('g_intro'))} (EN)`}
                  placeholder=""
                  textarea
                  value={draft.introEn}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => set('introEn', e.target.value)}
                />
                <TextField
                  label={`${t(k('g_audience'))} (FR)`}
                  placeholder={t(k('g_audience_ph'))}
                  value={draft.audienceFr}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => set('audienceFr', e.target.value)}
                />
                <TextField
                  label={`${t(k('g_audience'))} (EN)`}
                  placeholder=""
                  value={draft.audienceEn}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => set('audienceEn', e.target.value)}
                />
              </div>
              <SelectField
                label={t(k('g_icon'))}
                value={draft.icon}
                onValueChange={(v) => v && set('icon', v as Guide['icon'])}
                options={ICONS.map((x) => ({ value: x, label: t(k(`icon_${x}`)) }))}
              />
              <section className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl">{t(k('steps'))}</h3>
                  {canEdit && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        set('steps', [...draft.steps, blankStep()])
                        setOpen(draft.steps.length)
                      }}
                    >
                      {t(k('step_add'))}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-ink-muted">{t(k('steps_help'))}</p>
                {draft.steps.length === 0 && (
                  <p className="text-sm text-ink-muted">{t(k('steps_none'))}</p>
                )}
                <ol className="grid gap-2">
                  {draft.steps.map((s, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: steps have no stable id until saved
                    <li key={i} className="admin-panel grid gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          className="text-left font-semibold"
                          aria-expanded={open === i}
                          onClick={() => setOpen(open === i ? -1 : i)}
                        >
                          {i + 1}. {s.titleFr || t(k('step_untitled'))}
                        </button>
                        {canEdit && (
                          <span className="flex flex-wrap gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={i === 0}
                              onClick={() => move(i, -1)}
                            >
                              {t(k('up'))}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={i === draft.steps.length - 1}
                              onClick={() => move(i, 1)}
                            >
                              {t(k('down'))}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                set(
                                  'steps',
                                  draft.steps.filter((_, j) => j !== i),
                                )
                                setOpen(-1)
                              }}
                            >
                              {t(k('remove'))}
                            </Button>
                          </span>
                        )}
                      </div>
                      {open === i && (
                        <TabsBox
                          tabs={[
                            { id: 'fr', label: t(k('lang_fr')), content: stepPane(s, i, 'Fr') },
                            { id: 'en', label: t(k('lang_en')), content: stepPane(s, i, 'En') },
                          ]}
                        />
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
          <div className="dialog-actions">
            {canDelete && draft?.state === 'draft' && (
              <Button variant="danger" onClick={() => setDel(true)}>
                {t(k('delete'))}
              </Button>
            )}
            <Button variant="secondary" onClick={requestClose}>
              {t(k('close'))}
            </Button>
            {canEdit && draft && (
              <Button
                variant="secondary"
                loading={save.isPending}
                disabled={!dirty}
                onClick={() => save.mutate(draft)}
              >
                {t(k('save'))}
              </Button>
            )}
            {canPublish &&
              draft &&
              (draft.state === 'published' ? (
                <Button
                  variant="secondary"
                  loading={state.isPending}
                  onClick={() => state.mutate('unpublish')}
                >
                  {t(k('unpublish'))}
                </Button>
              ) : (
                <Button loading={state.isPending} onClick={() => state.mutate('publish')}>
                  {t(k('publish'))}
                </Button>
              ))}
          </div>
          <ConfirmDialog
            open={del}
            onClose={() => setDel(false)}
            title={t(k('delete_t'))}
            text={t(k('delete_p'))}
            confirmLabel={t(k('delete'))}
            danger
            busy={remove.isPending}
            onConfirm={() => remove.mutate()}
          />
        </div>
      )}
    </GuardedDialog>
  )
}
