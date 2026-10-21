/**
 * Départements (admin, /m/departments): one page per group — tagline, text in French and English, photo, when
 * they meet, contact, audience tags, and the people shown. A group leader sees and edits only their own group.
 * A person's name appears on the site only once their consent is recorded here. Also: the quiz « Où est ta place ? ».
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog, CoverField, GuardedDialog } from '@eec/content-kit'
import { DEFAULT_QUIZ, DEPARTMENT_TAGS, type Doc, EMPTY_DOC, type Quiz } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  CheckboxField,
  EmptyState,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'

const RichTextEditor = lazy(() => import('@eec/content-kit/editor'))
const k = (key: string) => `departments.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })

type Item = {
  groupId: string
  key: string
  nameFr: string
  nameEn: string | null
  kind: string
  active: boolean
  state: 'none' | 'draft' | 'published'
  updatedAt: string | null
}
type Page = {
  state: 'draft' | 'published'
  taglineFr: string
  taglineEn: string
  bodyFr: Doc
  bodyEn: Doc
  coverMediaId: string | null
  meetingFr: string
  meetingEn: string
  contactWhatsapp: string
  contactPhone: string
  tags: string[]
}
type Person = {
  id: string
  name: string
  roleFr: string
  roleEn: string
  publicConsent: boolean
  consentAt: string | null
}
type Detail = {
  group: { id: string; nameFr: string; nameEn: string | null }
  page: (Page & { id: string }) | null
  people: Person[]
}

const blankPage: Page = {
  state: 'draft',
  taglineFr: '',
  taglineEn: '',
  bodyFr: EMPTY_DOC,
  bodyEn: EMPTY_DOC,
  coverMediaId: null,
  meetingFr: '',
  meetingEn: '',
  contactWhatsapp: '',
  contactPhone: '',
  tags: [],
}

export default function DepartmentsPage() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const canQuiz = hasPermission(me, 'departments:quiz')
  const [editing, setEditing] = useState<Item | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  const list = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<{ items: Item[] }>('/departments'),
  })
  const items = list.data?.items ?? []
  const name = (g: Item) => (locale === 'en' && g.nameEn ? g.nameEn : g.nameFr)
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {canQuiz && (
          <Button variant="secondary" onClick={() => setQuizOpen(true)}>
            {t(k('quiz_edit'))}
          </Button>
        )}
      </header>
      {list.data && items.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
      ) : (
        <ul className="grid gap-2">
          {items.map((g) => (
            <li key={g.groupId} className="admin-row">
              <span className="grid">
                <strong>{name(g)}</strong>
                <span className="text-sm text-ink-muted">{t(k(`kind_${g.kind}`))}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge>{t(k(`state_${g.state}`))}</Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditing(g)}>
                  {t(k(g.state === 'none' ? 'create' : 'edit'))}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing && <PageEditor item={editing} onClose={() => setEditing(null)} />}
      {quizOpen && <QuizEditor onClose={() => setQuizOpen(false)} />}
    </div>
  )
}

function PageEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'departments:update')
  const canPublish = hasPermission(me, 'departments:publish')
  const detail = useQuery({
    queryKey: ['department', item.groupId],
    queryFn: () => api<Detail>(`/departments/${item.groupId}`),
  })
  const [draft, setDraft] = useState<Page | null>(null)
  const [initial, setInitial] = useState('')
  useEffect(() => {
    if (detail.data && !draft) {
      const p = { ...blankPage, ...(detail.data.page ?? {}) }
      setDraft(p)
      setInitial(JSON.stringify(p))
    }
  }, [detail.data, draft])
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['departments'] })
    qc.invalidateQueries({ queryKey: ['department', item.groupId] })
  }
  const save = useMutation({
    mutationFn: (p: Page) =>
      api(`/departments/${item.groupId}`, {
        method: 'PUT',
        body: {
          taglineFr: p.taglineFr,
          taglineEn: p.taglineEn,
          bodyFr: p.bodyFr,
          bodyEn: p.bodyEn,
          coverMediaId: p.coverMediaId,
          meetingFr: p.meetingFr,
          meetingEn: p.meetingEn,
          contactWhatsapp: p.contactWhatsapp,
          contactPhone: p.contactPhone,
          tags: p.tags,
        },
      }),
    onSuccess: (_d, p) => {
      setInitial(JSON.stringify(p))
      refresh()
      notify(t(k('saved')))
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const state = useMutation({
    mutationFn: async (to: 'publish' | 'unpublish') => {
      if (draft && JSON.stringify(draft) !== initial) await save.mutateAsync(draft)
      return api(`/departments/${item.groupId}/${to}`, { method: 'POST' })
    },
    onSuccess: (_d, to) => {
      refresh()
      setDraft((d) => (d ? { ...d, state: to === 'publish' ? 'published' : 'draft' } : d))
      setInitial((s) =>
        s.replace(/"state":"\w+"/, `"state":"${to === 'publish' ? 'published' : 'draft'}"`),
      )
      notify(t(k(to === 'publish' ? 'published' : 'unpublished')))
    },
    onError: () => notify(t(k('publish_error')), 'error'),
  })
  const set = <K extends keyof Page>(key: K, v: Page[K]) =>
    setDraft((d) => (d ? { ...d, [key]: v } : d))
  const groupName = locale === 'en' && item.nameEn ? item.nameEn : item.nameFr
  const dirty = !!draft && JSON.stringify(draft) !== initial

  const text = (lang: 'Fr' | 'En') =>
    draft && (
      <div className="grid gap-4">
        <TextField
          label={t(k('tagline'))}
          placeholder={t(k(lang === 'Fr' ? 'tagline_ph_fr' : 'tagline_ph_en'))}
          value={draft[`tagline${lang}`]}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set(`tagline${lang}`, e.target.value)}
        />
        <TextField
          label={t(k('meeting'))}
          placeholder={t(k(lang === 'Fr' ? 'meeting_ph_fr' : 'meeting_ph_en'))}
          hint={t(k('meeting_help'))}
          value={draft[`meeting${lang}`]}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set(`meeting${lang}`, e.target.value)}
        />
        <Suspense fallback={<div className="rte-loading" />}>
          <RichTextEditor
            key={lang}
            value={draft[`body${lang}`]}
            label={t(k('body'))}
            docTitle={groupName}
            docFallback={groupName}
            placeholder={t(k('body_ph'))}
            onChange={(doc: Doc) => set(`body${lang}`, doc)}
          />
        </Suspense>
      </div>
    )

  return (
    <GuardedDialog open onClose={onClose} dirty={dirty} wide title={groupName}>
      {(requestClose) => (
        <div className="dialog-body">
          <h2 className="dialog-title">{groupName}</h2>
          {!draft ? (
            <p className="text-ink-muted">…</p>
          ) : (
            <div className="grid gap-6">
              <TabsBox
                tabs={[
                  { id: 'fr', label: t(k('lang_fr')), content: text('Fr') },
                  { id: 'en', label: t(k('lang_en')), content: text('En') },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <CoverField
                  mediaId={draft.coverMediaId}
                  onChange={(id) => set('coverMediaId', id)}
                />
                <div className="grid content-start gap-4">
                  <TextField
                    label={t(k('whatsapp'))}
                    placeholder="https://wa.me/237…"
                    icon="whatsapp"
                    value={draft.contactWhatsapp}
                    disabled={!canEdit}
                    onChange={(e: { target: { value: string } }) =>
                      set('contactWhatsapp', e.target.value)
                    }
                  />
                  <TextField
                    label={t(k('phone'))}
                    placeholder="+237 6 00 00 00 00"
                    icon="phone"
                    value={draft.contactPhone}
                    disabled={!canEdit}
                    onChange={(e: { target: { value: string } }) =>
                      set('contactPhone', e.target.value)
                    }
                  />
                </div>
              </div>
              <fieldset className="grid gap-2">
                <legend className="field-label">{t(k('tags'))}</legend>
                <p className="text-sm text-ink-muted">{t(k('tags_help'))}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {DEPARTMENT_TAGS.map((tag) => (
                    <CheckboxField
                      key={tag}
                      label={t(k(`tag_${tag}`))}
                      checked={draft.tags.includes(tag)}
                      disabled={!canEdit}
                      onCheckedChange={(v: boolean) =>
                        set('tags', v ? [...draft.tags, tag] : draft.tags.filter((x) => x !== tag))
                      }
                    />
                  ))}
                </div>
              </fieldset>
              <People
                groupId={item.groupId}
                canEdit={canEdit && !!detail.data?.page}
                needsSave={!detail.data?.page}
                people={detail.data?.people ?? []}
                refresh={refresh}
              />
            </div>
          )}
          <div className="dialog-actions">
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
        </div>
      )}
    </GuardedDialog>
  )
}

type PersonForm = {
  id?: string
  name: string
  roleFr: string
  roleEn: string
  publicConsent: boolean
}
const blankPerson: PersonForm = { name: '', roleFr: '', roleEn: '', publicConsent: false }

function People({
  groupId,
  canEdit,
  needsSave,
  people,
  refresh,
}: {
  groupId: string
  canEdit: boolean
  needsSave: boolean
  people: Person[]
  refresh: () => void
}) {
  const { t, locale } = useLocale()
  const [form, setForm] = useState<PersonForm | null>(null)
  const [del, setDel] = useState<Person | null>(null)
  const save = useMutation({
    mutationFn: (f: PersonForm) =>
      f.id
        ? api(`/departments/${groupId}/people/${f.id}`, { method: 'PUT', body: f })
        : api(`/departments/${groupId}/people`, {
            method: 'POST',
            body: {
              name: f.name,
              roleFr: f.roleFr,
              roleEn: f.roleEn,
              publicConsent: f.publicConsent,
            },
          }),
    onSuccess: () => {
      setForm(null)
      refresh()
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/departments/${groupId}/people/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDel(null)
      refresh()
    },
  })
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl">{t(k('people'))}</h3>
        {canEdit && !form && (
          <Button variant="secondary" size="sm" onClick={() => setForm({ ...blankPerson })}>
            {t(k('person_add'))}
          </Button>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        {t(needsSave ? k('people_save_first') : k('people_help'))}
      </p>
      {people.length === 0 && !needsSave && (
        <p className="text-sm text-ink-muted">{t(k('people_none'))}</p>
      )}
      <ul className="grid gap-2">
        {people.map((p) => (
          <li key={p.id} className="admin-row">
            <span className="grid">
              <strong>{p.name}</strong>
              <span className="text-sm text-ink-muted">
                {(locale === 'en' && p.roleEn) || p.roleFr}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge>{t(k(p.publicConsent ? 'consent_yes' : 'consent_no'))}</Badge>
              {canEdit && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: p.id,
                        name: p.name,
                        roleFr: p.roleFr,
                        roleEn: p.roleEn,
                        publicConsent: p.publicConsent,
                      })
                    }
                  >
                    {t(k('edit'))}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDel(p)}>
                    {t(k('remove'))}
                  </Button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {form && (
        <form
          className="admin-panel grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (form.name.trim()) save.mutate(form)
          }}
        >
          <TextField
            label={t(k('person_name'))}
            placeholder={t(k('person_name_ph'))}
            icon="account"
            value={form.name}
            onChange={(e: { target: { value: string } }) =>
              setForm({ ...form, name: e.target.value })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t(k('person_role_fr'))}
              placeholder={t(k('person_role_ph_fr'))}
              value={form.roleFr}
              onChange={(e: { target: { value: string } }) =>
                setForm({ ...form, roleFr: e.target.value })
              }
            />
            <TextField
              label={t(k('person_role_en'))}
              placeholder={t(k('person_role_ph_en'))}
              value={form.roleEn}
              onChange={(e: { target: { value: string } }) =>
                setForm({ ...form, roleEn: e.target.value })
              }
            />
          </div>
          <CheckboxField
            label={t(k('consent_label'))}
            checked={form.publicConsent}
            onCheckedChange={(v: boolean) => setForm({ ...form, publicConsent: v })}
          />
          <p className="text-sm text-ink-muted">{t(k('consent_help'))}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={save.isPending}>
              {t(k('person_save'))}
            </Button>
            <Button variant="secondary" onClick={() => setForm(null)}>
              {t(k('cancel'))}
            </Button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={t(k('remove_t'))}
        text={t(k('remove_p'))}
        confirmLabel={t(k('remove'))}
        danger
        busy={remove.isPending}
        onConfirm={() => del && remove.mutate(del.id)}
      />
    </section>
  )
}

function QuizEditor({ onClose }: { onClose: () => void }) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const quiz = useQuery({
    queryKey: ['dept-quiz'],
    queryFn: () => api<{ quiz: Quiz }>('/departments/quiz'),
  })
  const [draft, setDraft] = useState<Quiz | null>(null)
  const [initial, setInitial] = useState('')
  useEffect(() => {
    if (quiz.data && !draft) {
      setDraft(quiz.data.quiz)
      setInitial(JSON.stringify(quiz.data.quiz))
    }
  }, [quiz.data, draft])
  const save = useMutation({
    mutationFn: (q: Quiz) => api('/departments/quiz', { method: 'PUT', body: q }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dept-quiz'] })
      notify(t(k('saved')))
      onClose()
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const patch = (
    qi: number,
    ai: number,
    p: Partial<Quiz['questions'][number]['answers'][number]>,
  ) =>
    setDraft(
      (d) =>
        d && {
          questions: d.questions.map((q, i) =>
            i !== qi
              ? q
              : { ...q, answers: q.answers.map((a, j) => (j === ai ? { ...a, ...p } : a)) },
          ),
        },
    )
  return (
    <GuardedDialog
      open
      onClose={onClose}
      dirty={!!draft && JSON.stringify(draft) !== initial}
      wide
      title={t(k('quiz_edit'))}
    >
      {(requestClose) => (
        <div className="dialog-body">
          <h2 className="dialog-title">{t(k('quiz_edit'))}</h2>
          <p className="text-sm text-ink-muted">{t(k('quiz_help'))}</p>
          {draft?.questions.map((q, qi) => (
            <section key={q.id} className="admin-panel grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={`${t(k('quiz_question'))} ${qi + 1} (FR)`}
                  placeholder={DEFAULT_QUIZ.questions[qi]?.textFr ?? ''}
                  value={q.textFr}
                  onChange={(e: { target: { value: string } }) =>
                    setDraft({
                      questions: draft.questions.map((x, i) =>
                        i === qi ? { ...x, textFr: e.target.value } : x,
                      ),
                    })
                  }
                />
                <TextField
                  label={`${t(k('quiz_question'))} ${qi + 1} (EN)`}
                  placeholder={DEFAULT_QUIZ.questions[qi]?.textEn ?? ''}
                  value={q.textEn}
                  onChange={(e: { target: { value: string } }) =>
                    setDraft({
                      questions: draft.questions.map((x, i) =>
                        i === qi ? { ...x, textEn: e.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
              {q.answers.map((a, ai) => (
                <div key={a.id} className="grid gap-2 rounded-lg bg-surface-2 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={`${t(k('quiz_answer'))} (FR)`}
                      placeholder=""
                      value={a.textFr}
                      onChange={(e: { target: { value: string } }) =>
                        patch(qi, ai, { textFr: e.target.value })
                      }
                    />
                    <TextField
                      label={`${t(k('quiz_answer'))} (EN)`}
                      placeholder=""
                      value={a.textEn}
                      onChange={(e: { target: { value: string } }) =>
                        patch(qi, ai, { textEn: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {DEPARTMENT_TAGS.map((tag) => (
                      <CheckboxField
                        key={tag}
                        label={t(k(`tag_${tag}`))}
                        checked={a.tags.includes(tag)}
                        onCheckedChange={(v: boolean) =>
                          patch(qi, ai, {
                            tags: v ? [...a.tags, tag] : a.tags.filter((x) => x !== tag),
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
          <div className="dialog-actions">
            <Button variant="secondary" onClick={requestClose}>
              {t(k('close'))}
            </Button>
            <Button loading={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {t(k('save'))}
            </Button>
          </div>
        </div>
      )}
    </GuardedDialog>
  )
}
