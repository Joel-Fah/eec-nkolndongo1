/**
 * Pages du site (admin, /m/story): the words of the story pages (content slots, with a preview), the history of
 * « Gravir la colline » (milestones), and Pastors and Council (a name is public only with a recorded consent).
 * The pages' structure and animation stay in code — this is not a page builder.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog, CoverField, GuardedDialog } from '@eec/content-kit'
import { COUNCIL_ROLES, type Doc, EMPTY_DOC, PAGE_SLOTS, type SlotDef } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  CheckboxField,
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
const k = (key: string) => `story.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })

type SlotRow = {
  id: string
  pageKey: string
  slotKey: string
  valueFr: string
  valueEn: string
  bodyFr: Doc
  bodyEn: Doc
  state: 'draft' | 'published'
}
type Milestone = {
  id: string
  year: string
  titleFr: string
  titleEn: string
  textFr: string
  textEn: string
  mediaId: string | null
  sortOrder: number
  state: 'draft' | 'published'
}
type Member = {
  id: string
  name: string
  roleKey: string
  titleFr: string
  titleEn: string
  photoMediaId: string | null
  publicConsent: boolean
  term: string
  sortOrder: number
}

export default function PagesAdmin() {
  const { t } = useLocale()
  const me = useMe().data
  const tabs = [
    hasPermission(me, 'story:read') && {
      id: 'slots',
      label: t(k('tab_texts')),
      content: <Slots />,
    },
    hasPermission(me, 'story:read') && {
      id: 'history',
      label: t(k('tab_history')),
      content: <History />,
    },
    hasPermission(me, 'story:council') && {
      id: 'council',
      label: t(k('tab_council')),
      content: <Council />,
    },
  ].filter(Boolean) as { id: string; label: string; content: React.ReactNode }[]
  return (
    <div className="grid gap-6">
      <header className="grid max-w-[62ch] gap-2">
        <h1 className="text-4xl">{t(k('title'))}</h1>
        <p className="text-ink-muted">{t(k('lead'))}</p>
      </header>
      <TabsBox tabs={tabs} />
    </div>
  )
}

/* ── Texts (content slots) ─────────────────────────────────────────── */
function Slots() {
  const { t, locale } = useLocale()
  const q = useQuery({
    queryKey: ['page-slots'],
    queryFn: () => api<{ slots: SlotRow[] }>('/story/slots'),
  })
  return (
    <div className="grid gap-6">
      <p className="text-sm text-ink-muted">{t(k('texts_help'))}</p>
      {Object.entries(PAGE_SLOTS).map(([page, def]) => (
        <section key={page} className="admin-panel grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl">{def.label[locale]}</h2>
            <a
              className="btn btn-secondary btn-sm"
              href={`/${def.path[locale]}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t(k('view_page'))}
              <Icon name="external" size={16} />
            </a>
          </div>
          {def.slots.map((s) => (
            <SlotForm
              key={s.key}
              page={page}
              slot={s}
              row={q.data?.slots.find((r) => r.pageKey === page && r.slotKey === s.key)}
              ready={!!q.data}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function SlotForm({
  page,
  slot,
  row,
  ready,
}: {
  page: string
  slot: SlotDef
  row?: SlotRow
  ready: boolean
}) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'story:edit')
  const canPublish = hasPermission(me, 'story:publish')
  const [v, setV] = useState({
    valueFr: '',
    valueEn: '',
    bodyFr: EMPTY_DOC as Doc,
    bodyEn: EMPTY_DOC as Doc,
  })
  const [initial, setInitial] = useState('')
  useEffect(() => {
    if (ready) {
      const n = {
        valueFr: row?.valueFr ?? '',
        valueEn: row?.valueEn ?? '',
        bodyFr: row?.bodyFr ?? EMPTY_DOC,
        bodyEn: row?.bodyEn ?? EMPTY_DOC,
      }
      setV(n)
      setInitial(JSON.stringify(n))
    }
  }, [ready, row])
  const dirty = JSON.stringify(v) !== initial
  const refresh = () => qc.invalidateQueries({ queryKey: ['page-slots'] })
  const save = useMutation({
    mutationFn: () =>
      api(`/story/slots/${page}/${slot.key}`, {
        method: 'PUT',
        body:
          slot.type === 'rich'
            ? { bodyFr: v.bodyFr, bodyEn: v.bodyEn }
            : { valueFr: v.valueFr, valueEn: v.valueEn },
      }),
    onSuccess: () => {
      refresh()
      notify(t(k('saved')))
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const state = useMutation({
    mutationFn: async (to: 'publish' | 'unpublish') => {
      if (dirty) await save.mutateAsync()
      return api(`/story/slots/${page}/${slot.key}/${to}`, { method: 'POST' })
    },
    onSuccess: (_d, to) => {
      refresh()
      notify(t(k(to === 'publish' ? 'published' : 'unpublished')))
    },
    onError: () => notify(t(k('publish_error')), 'error'),
  })
  const status = !row ? 'builtin' : row.state
  const field = (lang: 'Fr' | 'En') =>
    slot.type === 'rich' ? (
      <Suspense fallback={<div className="rte-loading" />}>
        <RichTextEditor
          key={`${row?.id}-${lang}`}
          value={v[`body${lang}`]}
          label={slot.label[locale]}
          docTitle={slot.label[locale]}
          docFallback={slot.label[locale]}
          placeholder=""
          onChange={(doc: Doc) => setV((x) => ({ ...x, [`body${lang}`]: doc }))}
        />
      </Suspense>
    ) : slot.type === 'number' ? (
      <TextField
        label={slot.label[locale]}
        placeholder=""
        inputMode="numeric"
        maxLength={slot.max}
        value={v.valueFr}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) =>
          setV((x) => ({
            ...x,
            valueFr: e.target.value.replace(/\D/g, ''),
            valueEn: e.target.value.replace(/\D/g, ''),
          }))
        }
      />
    ) : (
      <TextField
        label={slot.label[locale]}
        placeholder=""
        textarea
        maxLength={slot.max}
        hint={`${v[`value${lang}`].length} / ${slot.max}`}
        value={v[`value${lang}`]}
        disabled={!canEdit}
        onChange={(e: { target: { value: string } }) =>
          setV((x) => ({ ...x, [`value${lang}`]: e.target.value }))
        }
      />
    )
  return (
    <div className="grid gap-3 rounded-lg bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg">{slot.label[locale]}</h3>
        <Badge>{t(k(`status_${status}`))}</Badge>
      </div>
      <p className="text-sm text-ink-muted">{slot.help[locale]}</p>
      {slot.type === 'number' ? (
        field('Fr')
      ) : (
        <TabsBox
          tabs={[
            { id: 'fr', label: t(k('lang_fr')), content: field('Fr') },
            { id: 'en', label: t(k('lang_en')), content: field('En') },
          ]}
        />
      )}
      {slot.type === 'text' && v.valueFr.trim() && (
        <div className="rounded-lg bg-surface p-4">
          <span className="field-label">{t(k('preview'))}</span>
          <p className="mt-1 font-display text-xl">{v.valueFr}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button
            variant="secondary"
            loading={save.isPending}
            disabled={!dirty}
            onClick={() => save.mutate()}
          >
            {t(k('save'))}
          </Button>
        )}
        {canPublish &&
          (status === 'published' && !dirty ? (
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
      {!canPublish && canEdit && (
        <p className="text-sm text-ink-muted">{t(k('needs_publisher'))}</p>
      )}
    </div>
  )
}

/* ── History ───────────────────────────────────────────────────────── */
const blankMs: Omit<Milestone, 'id' | 'state'> = {
  year: '',
  titleFr: '',
  titleEn: '',
  textFr: '',
  textEn: '',
  mediaId: null,
  sortOrder: 0,
}

function History() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'story:edit')
  const canPublish = hasPermission(me, 'story:publish')
  const [form, setForm] = useState<(Partial<Milestone> & typeof blankMs) | null>(null)
  const [initial, setInitial] = useState('')
  const [del, setDel] = useState<Milestone | null>(null)
  const list = useQuery({
    queryKey: ['milestones'],
    queryFn: () => api<{ items: Milestone[] }>('/story/milestones'),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['milestones'] })
  const open = (f: Partial<Milestone> & typeof blankMs) => {
    setInitial(JSON.stringify(f))
    setForm(f)
  }
  const save = useMutation({
    mutationFn: (f: Partial<Milestone> & typeof blankMs) => {
      const { id, state: _s, ...body } = f as Milestone
      return id
        ? api(`/story/milestones/${id}`, { method: 'PUT', body })
        : api('/story/milestones', { method: 'POST', body })
    },
    onSuccess: () => {
      setForm(null)
      refresh()
      notify(t(k('saved')))
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const toggle = useMutation({
    mutationFn: (m: Milestone) =>
      api(`/story/milestones/${m.id}/${m.state === 'published' ? 'unpublish' : 'publish'}`, {
        method: 'POST',
      }),
    onSuccess: refresh,
    onError: () => notify(t(k('publish_error_ms')), 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/story/milestones/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDel(null)
      refresh()
    },
  })
  const items = list.data?.items ?? []
  const set = (p: Partial<Milestone>) => setForm((f) => f && { ...f, ...p })
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[62ch] text-sm text-ink-muted">{t(k('history_help'))}</p>
        {canEdit && (
          <Button onClick={() => open({ ...blankMs, sortOrder: items.length })}>
            {t(k('ms_add'))}
          </Button>
        )}
      </div>
      {list.data && items.length === 0 ? (
        <EmptyState title={t(k('ms_empty_t'))} text={t(k('ms_empty_p'))} />
      ) : (
        <ol className="grid gap-2">
          {items.map((m) => (
            <li key={m.id} className="admin-row">
              <span className="grid">
                <strong>
                  {m.year} · {(locale === 'en' && m.titleEn) || m.titleFr}
                </strong>
                <span className="text-sm text-ink-muted">{m.textFr.slice(0, 90)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge>{t(k(`status_${m.state}`))}</Badge>
                {canPublish && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={toggle.isPending}
                    onClick={() => toggle.mutate(m)}
                  >
                    {t(k(m.state === 'published' ? 'unpublish' : 'publish'))}
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => open(m)}>
                      {t(k('edit'))}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDel(m)}>
                      {t(k('delete'))}
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      <GuardedDialog
        open={!!form}
        onClose={() => setForm(null)}
        dirty={!!form && JSON.stringify(form) !== initial}
        wide
      >
        {(requestClose) =>
          form && (
            <form
              className="dialog-body"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(form)
              }}
            >
              <h2 className="dialog-title">{t(k(form.id ? 'ms_edit' : 'ms_add'))}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  label={t(k('ms_year'))}
                  placeholder={t(k('ms_year_ph'))}
                  value={form.year}
                  onChange={(e: { target: { value: string } }) => set({ year: e.target.value })}
                />
                <TextField
                  label={`${t(k('ms_title'))} (FR)`}
                  placeholder=""
                  value={form.titleFr}
                  onChange={(e: { target: { value: string } }) => set({ titleFr: e.target.value })}
                />
                <TextField
                  label={`${t(k('ms_title'))} (EN)`}
                  placeholder=""
                  value={form.titleEn}
                  onChange={(e: { target: { value: string } }) => set({ titleEn: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={`${t(k('ms_text'))} (FR)`}
                  placeholder=""
                  textarea
                  maxLength={800}
                  value={form.textFr}
                  onChange={(e: { target: { value: string } }) => set({ textFr: e.target.value })}
                />
                <TextField
                  label={`${t(k('ms_text'))} (EN)`}
                  placeholder=""
                  textarea
                  maxLength={800}
                  value={form.textEn}
                  onChange={(e: { target: { value: string } }) => set({ textEn: e.target.value })}
                />
              </div>
              <CoverField mediaId={form.mediaId} onChange={(id) => set({ mediaId: id })} />
              <p className="text-sm text-ink-muted">{t(k('ms_validate'))}</p>
              <div className="dialog-actions">
                <Button variant="secondary" onClick={requestClose}>
                  {t(k('cancel'))}
                </Button>
                <Button type="submit" loading={save.isPending}>
                  {t(k('save'))}
                </Button>
              </div>
            </form>
          )
        }
      </GuardedDialog>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={t(k('ms_delete_t'))}
        text={t(k('ms_delete_p'))}
        confirmLabel={t(k('delete'))}
        danger
        busy={remove.isPending}
        onConfirm={() => del && remove.mutate(del.id)}
      />
    </div>
  )
}

/* ── Council ───────────────────────────────────────────────────────── */
const blankMember = {
  name: '',
  roleKey: 'anciens',
  titleFr: '',
  titleEn: '',
  photoMediaId: null as string | null,
  publicConsent: false,
  term: '',
  sortOrder: 0,
}

function Council() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const [form, setForm] = useState<(Partial<Member> & typeof blankMember) | null>(null)
  const [initial, setInitial] = useState('')
  const [del, setDel] = useState<Member | null>(null)
  const list = useQuery({
    queryKey: ['council'],
    queryFn: () => api<{ items: Member[] }>('/story/council'),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['council'] })
  const open = (f: Partial<Member> & typeof blankMember) => {
    setInitial(JSON.stringify(f))
    setForm(f)
  }
  const save = useMutation({
    mutationFn: (f: Partial<Member> & typeof blankMember) => {
      const { id, ...body } = f as Member
      return id
        ? api(`/story/council/${id}`, { method: 'PUT', body })
        : api('/story/council', { method: 'POST', body })
    },
    onSuccess: () => {
      setForm(null)
      refresh()
      notify(t(k('saved')))
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/story/council/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDel(null)
      refresh()
    },
  })
  const items = list.data?.items ?? []
  const set = (p: Partial<Member>) => setForm((f) => f && { ...f, ...p })
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[62ch] text-sm text-ink-muted">{t(k('council_help'))}</p>
        <Button onClick={() => open({ ...blankMember })}>{t(k('member_add'))}</Button>
      </div>
      {list.data && items.length === 0 && (
        <EmptyState title={t(k('council_empty_t'))} text={t(k('council_empty_p'))} />
      )}
      {COUNCIL_ROLES.map((r) => {
        const ms = items.filter((m) => m.roleKey === r.key)
        if (!ms.length) return null
        return (
          <section key={r.key} className="admin-panel grid gap-2">
            <h2 className="text-xl">{r[locale]}</h2>
            <ul className="grid gap-2">
              {ms.map((m) => (
                <li key={m.id} className="admin-row">
                  <span className="grid">
                    <strong>{m.name}</strong>
                    <span className="text-sm text-ink-muted">
                      {(locale === 'en' && m.titleEn) || m.titleFr}
                      {m.term ? ` · ${m.term}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge>{t(k(m.publicConsent ? 'consent_yes' : 'consent_no'))}</Badge>
                    <Button variant="secondary" size="sm" onClick={() => open(m)}>
                      {t(k('edit'))}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDel(m)}>
                      {t(k('delete'))}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <GuardedDialog
        open={!!form}
        onClose={() => setForm(null)}
        dirty={!!form && JSON.stringify(form) !== initial}
      >
        {(requestClose) =>
          form && (
            <form
              className="dialog-body"
              onSubmit={(e) => {
                e.preventDefault()
                if (form.name.trim()) save.mutate(form)
              }}
            >
              <h2 className="dialog-title">{t(k(form.id ? 'member_edit' : 'member_add'))}</h2>
              <TextField
                label={t(k('member_name'))}
                placeholder={t(k('member_name_ph'))}
                icon="account"
                value={form.name}
                onChange={(e: { target: { value: string } }) => set({ name: e.target.value })}
              />
              <SelectField
                label={t(k('member_role'))}
                value={form.roleKey}
                onValueChange={(v) => v && set({ roleKey: v })}
                options={COUNCIL_ROLES.map((r) => ({ value: r.key, label: r[locale] }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={`${t(k('member_title'))} (FR)`}
                  placeholder=""
                  value={form.titleFr}
                  onChange={(e: { target: { value: string } }) => set({ titleFr: e.target.value })}
                />
                <TextField
                  label={`${t(k('member_title'))} (EN)`}
                  placeholder=""
                  value={form.titleEn}
                  onChange={(e: { target: { value: string } }) => set({ titleEn: e.target.value })}
                />
              </div>
              <TextField
                label={t(k('member_term'))}
                placeholder={t(k('member_term_ph'))}
                value={form.term}
                onChange={(e: { target: { value: string } }) => set({ term: e.target.value })}
              />
              <CoverField
                mediaId={form.photoMediaId}
                onChange={(id) => set({ photoMediaId: id })}
              />
              <CheckboxField
                label={t(k('consent_label'))}
                checked={form.publicConsent}
                onCheckedChange={(v: boolean) => set({ publicConsent: v })}
              />
              <p className="text-sm text-ink-muted">{t(k('consent_help'))}</p>
              <div className="dialog-actions">
                <Button variant="secondary" onClick={requestClose}>
                  {t(k('cancel'))}
                </Button>
                <Button type="submit" loading={save.isPending}>
                  {t(k('save'))}
                </Button>
              </div>
            </form>
          )
        }
      </GuardedDialog>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={t(k('member_delete_t'))}
        text={t(k('member_delete_p'))}
        confirmLabel={t(k('delete'))}
        danger
        busy={remove.isPending}
        onConfirm={() => del && remove.mutate(del.id)}
      />
    </div>
  )
}
