/**
 * Registrations (admin, /m/registrations): the forms, who signed up (with how long their data is kept, counted down in colour),
 * adding someone by hand, a one-handed check-in view that shows names only, and the CSV export for those who may.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog } from '@eec/content-kit'
import { AGE_BANDS, type AgeBand, daysLeft, normalizePhone, type RetentionLevel } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  CheckboxField,
  EmptyState,
  Icon,
  SelectField,
  SwitchField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { looksSensitive } from './rules.ts'
import { FIELD_KINDS, type FieldKind, type FormField } from './schema.ts'

type Counts = {
  confirmed: number
  waitlist: number
  cancelled: number
  present: number
  registrations: number
}
type Retention = { purgeOn: string; daysLeft: number; level: RetentionLevel }
type Form = {
  id: string
  groupId: string | null
  slug: string
  state: 'draft' | 'published'
  titleFr: string
  titleEn: string
  introFr: string
  introEn: string
  eventSlug: string | null
  eventDate: string
  opensAt: string | null
  closesAt: string | null
  capacity: number | null
  waitlist: boolean
  audience: 'open' | 'members'
  forMinors: boolean
  askWhatsapp: boolean
  fields: FormField[]
  counts: Counts
  retention: Retention
}
type Person = { id: string; firstName: string; ageBand: AgeBand; checkedInAt: string | null }
type Reg = {
  id: string
  code: string
  status: 'confirmed' | 'waitlist' | 'cancelled'
  name: string
  phone: string
  whatsapp: string
  email: string
  partySize: number
  answers: Record<string, string | string[] | boolean>
  guardianConfirmed: boolean
  consentAt: string
  addedBy: string | null
  checkedInAt: string | null
  promotedAt: string | null
  notifiedAt: string | null
  createdAt: string
  people: Person[]
}

const ERRORS = [
  'bad_phone',
  'bad_whatsapp',
  'guardian_required',
  'children_required',
  'answers',
  'full',
  'duplicate',
]
const k = (key: string) => `registrations.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
const newId = () =>
  Math.random()
    .toString(36)
    .slice(2, 8)
    .replace(/[^a-z0-9]/g, 'x')
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
/** A date-time typed in the parish's own time (Africa/Douala, UTC+1 all year) ⇄ the instant stored. */
const toLocalInput = (iso: string | null) =>
  iso ? new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 16) : ''
const toIso = (v: string) => (v ? new Date(Date.parse(`${v}:00Z`) - 3_600_000).toISOString() : null)
const dayText = (d: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${d}T12:00:00Z`))

export default function RegistrationsPage() {
  const [openId, setOpenId] = useState<string | null>(() => location.hash.slice(1) || null)
  useEffect(() => {
    const onHash = () => setOpenId(location.hash.slice(1) || null)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const open = (id: string | null) => {
    history.replaceState(null, '', id ? `#${id}` : location.pathname + location.search)
    setOpenId(id)
  }
  return openId ? <FormView id={openId} onBack={() => open(null)} /> : <Forms onOpen={open} />
}

/* ── The time left before the data is deleted, in colour ──────────────── */
function RetentionChip({ r, big }: { r: Retention; big?: boolean }) {
  const { t, locale } = useLocale()
  const days = daysLeft(r.purgeOn)
  const text =
    days < 0
      ? t(k('retention_due'))
      : days === 0
        ? t(k('retention_today'))
        : t(k('retention_in'), { n: String(days) })
  return (
    <span
      className={big ? 'reg-retention reg-retention-big' : 'reg-retention'}
      data-level={r.level}
    >
      <Icon name={r.level === 'calm' ? 'clock' : 'alert'} size={big ? 20 : 16} />
      <span>
        <strong>{text}</strong>
        {big && (
          <span className="reg-retention-sub">
            {t(k('retention_on'), { date: dayText(r.purgeOn, locale) })}
          </span>
        )}
      </span>
    </span>
  )
}

/* ── The forms ────────────────────────────────────────────────────────── */
function Forms({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['reg-forms'],
    queryFn: () => api<{ items: Form[] }>('/registrations/forms'),
  })
  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/registrations/forms', {
        method: 'POST',
        body: { titleFr: t(k('new_title')), eventDate: today(), state: 'draft' },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['reg-forms'] })
      onOpen(r.id)
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const items = list.data?.items ?? []
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {hasPermission(me, 'registrations:edit') && (
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            <Icon name="plus" size={20} />
            {t(k('new_form'))}
          </Button>
        )}
      </header>
      {list.data && items.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((f) => (
            <li key={f.id}>
              <button type="button" className="admin-panel plan-tile" onClick={() => onOpen(f.id)}>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={f.state === 'published' ? 'success' : 'warning'}>
                    {t(k(`state_${f.state}`))}
                  </Badge>
                  <Badge>{t(k(`audience_${f.audience}`))}</Badge>
                </span>
                <strong className="font-display text-2xl">
                  {(locale === 'en' && f.titleEn) || f.titleFr}
                </strong>
                <span className="text-sm text-ink-muted">{dayText(f.eventDate, locale)}</span>
                <span className="text-sm">
                  {t(k('counts'), {
                    n: String(f.counts.confirmed),
                    cap: f.capacity == null ? '∞' : String(f.capacity),
                    w: String(f.counts.waitlist),
                  })}
                </span>
                {f.counts.registrations > 0 && <RetentionChip r={f.retention} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── One form ─────────────────────────────────────────────────────────── */
function FormView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'registrations:edit')
  const canManage = hasPermission(me, 'registrations:manage')
  const canExport = hasPermission(me, 'registrations:export')
  const canDelete = hasPermission(me, 'registrations:delete')
  const [confirm, setConfirm] = useState(false)
  const data = useQuery({
    queryKey: ['reg-people', id],
    queryFn: () => api<{ form: Form; items: Reg[] }>(`/registrations/forms/${id}/registrations`),
  })
  const form = data.data?.form
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['reg-people', id] })
    qc.invalidateQueries({ queryKey: ['reg-forms'] })
    qc.invalidateQueries({ queryKey: ['reg-checkin', id] })
  }
  const del = useMutation({
    mutationFn: () => api(`/registrations/forms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('form_deleted')))
      qc.invalidateQueries({ queryKey: ['reg-forms'] })
      onBack()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const exportCsv = async () => {
    const res = await fetch(`/api/registrations/forms/${id}/export.csv`, { credentials: 'include' })
    if (!res.ok) return say(t(k('error')), 'danger')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inscrits-${form?.slug ?? id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  if (data.isError) return <EmptyState title={t(k('empty_t'))} text="" />
  if (!form) return <div className="admin-panel" aria-busy="true" />
  const published = form.state === 'published'
  const sitePath = `/${locale}/${locale === 'fr' ? 'agenda/inscription' : 'calendar/register'}/${form.slug}/`
  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
          {t(k('back'))}
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={published ? 'success' : 'warning'}>{t(k(`state_${form.state}`))}</Badge>
            <Badge>{t(k(`audience_${form.audience}`))}</Badge>
          </span>
          <h1 className="text-4xl">{(locale === 'en' && form.titleEn) || form.titleFr}</h1>
          <p className="text-ink-muted">
            {dayText(form.eventDate, locale)} ·{' '}
            {t(k('counts'), {
              n: String(form.counts.confirmed),
              cap: form.capacity == null ? '∞' : String(form.capacity),
              w: String(form.counts.waitlist),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {published && (
            <a className="btn btn-secondary" href={sitePath} target="_blank" rel="noreferrer">
              {t(k('view_site'))}
              <Icon name="external" size={16} />
            </a>
          )}
          {canExport && form.counts.registrations > 0 && (
            <Button variant="secondary" onClick={exportCsv}>
              <Icon name="download" size={20} />
              {t(k('export'))}
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              {t(k('delete'))}
            </Button>
          )}
        </div>
      </header>
      <section className="admin-panel grid gap-2" aria-label={t(k('retention_h'))}>
        <RetentionChip r={form.retention} big />
        <p className="text-sm text-ink-muted">{t(k('retention_help'))}</p>
      </section>
      <TabsBox
        tabs={[
          {
            id: 'people',
            label: t(k('tab_people')),
            content: (
              <People
                form={form}
                items={data.data?.items ?? []}
                canManage={canManage}
                onChange={refresh}
              />
            ),
          },
          ...(canManage
            ? [{ id: 'checkin', label: t(k('tab_checkin')), content: <Checkin id={id} /> }]
            : []),
          {
            id: 'form',
            label: t(k('tab_form')),
            content: <FormEditor form={form} canEdit={canEdit} onChange={refresh} />,
          },
        ]}
      />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t(k('delete_t'))}
        text={t(k('delete_p'))}
        confirmLabel={t(k('delete'))}
        danger
        busy={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  )
}

/* ── Who signed up ────────────────────────────────────────────────────── */
function People({
  form,
  items,
  canManage,
  onChange,
}: {
  form: Form
  items: Reg[]
  canManage: boolean
  onChange: () => void
}) {
  const { t, locale } = useLocale()
  const [adding, setAdding] = useState(false)
  const [drop, setDrop] = useState<Reg | null>(null)
  const act = useMutation({
    mutationFn: (v: { id: string; action: string }) =>
      api(`/registrations/registrations/${v.id}`, { method: 'PATCH', body: { action: v.action } }),
    onSuccess: onChange,
    onError: () => say(t(k('error')), 'danger'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api(`/registrations/registrations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('person_deleted')))
      setDrop(null)
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const answer = (r: Reg, f: FormField) => {
    const v = r.answers[f.id]
    if (v === undefined) return ''
    return Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? t(k(v ? 'yes' : 'no')) : v
  }
  const toTell = items.filter((r) => r.promotedAt && !r.notifiedAt && r.status === 'confirmed')
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Douala',
  })
  return (
    <div className="grid gap-4">
      {toTell.length > 0 && (
        <div className="reg-tell" role="status">
          <Icon name="alert" size={20} />
          <span>
            <strong>{t(k('to_tell_h'), { n: String(toTell.length) })}</strong> {t(k('to_tell_p'))}
          </span>
        </div>
      )}
      {canManage && (
        <div>
          <Button variant="secondary" onClick={() => setAdding((v) => !v)}>
            <Icon name="plus" size={20} />
            {t(k('add_person'))}
          </Button>
        </div>
      )}
      {adding && (
        <AddPerson
          form={form}
          onDone={() => {
            setAdding(false)
            onChange()
          }}
        />
      )}
      {items.length === 0 ? (
        <EmptyState title={t(k('people_empty_t'))} text={t(k('people_empty_p'))} />
      ) : (
        <ul className="grid gap-2">
          {items.map((r) => (
            <li key={r.id} className="admin-panel reg-row" data-status={r.status}>
              <div className="grid gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong>{r.name}</strong>
                  <Badge
                    tone={
                      r.status === 'confirmed'
                        ? 'success'
                        : r.status === 'waitlist'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {t(k(`status_${r.status}`))}
                  </Badge>
                  {r.promotedAt && !r.notifiedAt && r.status === 'confirmed' && (
                    <Badge tone="warning">{t(k('to_tell'))}</Badge>
                  )}
                  <span className="text-sm text-ink-muted">
                    {r.code} · {t(k('party'), { n: String(r.partySize) })}
                  </span>
                </span>
                <span className="reg-contact text-sm">
                  <a href={`tel:${r.phone}`}>{normalizePhone(r.phone)?.display ?? r.phone}</a>
                  {r.whatsapp && (
                    <a
                      href={`https://wa.me/${r.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp {normalizePhone(r.whatsapp)?.display ?? r.whatsapp}
                    </a>
                  )}
                  {r.email && <span>{r.email}</span>}
                </span>
                {r.people.length > 0 && (
                  <span className="text-sm text-ink-muted">
                    {r.people
                      .map((p) => `${p.firstName} (${t(k(`age_${p.ageBand.replace('-', '_')}`))})`)
                      .join(' · ')}
                  </span>
                )}
                {form.fields.map((f) =>
                  answer(r, f) ? (
                    <span key={f.id} className="text-sm text-ink-muted">
                      {(locale === 'en' && f.labelEn) || f.labelFr} : {answer(r, f)}
                    </span>
                  ) : null,
                )}
                <span className="text-xs text-ink-muted">
                  {t(k('consent_on'), { date: when.format(new Date(r.consentAt)) })}
                  {r.addedBy ? ` · ${t(k('by_hand'))}` : ''}
                </span>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-start gap-1">
                  {r.promotedAt && !r.notifiedAt && r.status === 'confirmed' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => act.mutate({ id: r.id, action: 'notified' })}
                    >
                      {t(k('mark_notified'))}
                    </Button>
                  )}
                  {r.status === 'waitlist' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => act.mutate({ id: r.id, action: 'confirm' })}
                    >
                      {t(k('confirm_now'))}
                    </Button>
                  )}
                  {r.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act.mutate({ id: r.id, action: 'cancel' })}
                    >
                      {t(k('cancel_reg'))}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t(k('delete_person'))}
                    onClick={() => setDrop(r)}
                  >
                    <Icon name="trash" size={16} />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!drop}
        onClose={() => setDrop(null)}
        title={t(k('delete_person_t'))}
        text={t(k('delete_person_p'))}
        confirmLabel={t(k('delete_person'))}
        danger
        busy={del.isPending}
        onConfirm={() => drop && del.mutate(drop.id)}
      />
    </div>
  )
}

function AddPerson({ form, onDone }: { form: Form; onDone: () => void }) {
  const { t, locale } = useLocale()
  const [v, setV] = useState({ name: '', phone: '', whatsapp: '', partySize: 1 })
  const [kids, setKids] = useState<{ firstName: string; ageBand: AgeBand }[]>([])
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({})
  const phone = v.phone ? normalizePhone(v.phone) : null
  const save = useMutation({
    mutationFn: () =>
      api(`/registrations/forms/${form.id}/registrations`, {
        method: 'POST',
        body: {
          name: v.name,
          phone: v.phone,
          whatsapp: v.whatsapp,
          partySize: v.partySize,
          children: kids,
          guardian: form.forMinors,
          answers,
        },
      }),
    onSuccess: () => {
      say(t(k('person_added')))
      onDone()
    },
    onError: (e) => {
      const code = (e as { code?: string }).code
      say(t(k(code && ERRORS.includes(code) ? `err_${code}` : 'error')), 'danger')
    },
  })
  return (
    <div className="admin-panel grid gap-3">
      <p className="text-sm text-ink-muted">{t(k('add_help'))}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t(k('f_name'))}
          placeholder=""
          value={v.name}
          onChange={(e: { target: { value: string } }) =>
            setV((x) => ({ ...x, name: e.target.value }))
          }
        />
        <TextField
          label={t(k('f_phone'))}
          placeholder="6 77 12 34 56"
          hint={v.phone ? (phone ? phone.display : t(k('err_bad_phone'))) : t(k('f_phone_help'))}
          inputMode="tel"
          value={v.phone}
          onChange={(e: { target: { value: string } }) =>
            setV((x) => ({ ...x, phone: e.target.value }))
          }
        />
        {form.askWhatsapp && (
          <TextField
            label={t(k('f_whatsapp'))}
            placeholder=""
            hint={t(k('f_whatsapp_help'))}
            inputMode="tel"
            value={v.whatsapp}
            onChange={(e: { target: { value: string } }) =>
              setV((x) => ({ ...x, whatsapp: e.target.value }))
            }
          />
        )}
        {!form.forMinors && (
          <TextField
            label={t(k('f_party'))}
            placeholder=""
            type="number"
            min={1}
            max={10}
            value={String(v.partySize)}
            onChange={(e: { target: { value: string } }) =>
              setV((x) => ({
                ...x,
                partySize: Math.min(Math.max(Number(e.target.value) || 1, 1), 10),
              }))
            }
          />
        )}
      </div>
      {form.forMinors && (
        <div className="grid gap-2">
          <h3 className="text-lg">{t(k('f_children'))}</h3>
          {kids.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: edited in place
            <div key={i} className="link-row" data-other="">
              <TextField
                label={t(k('f_child_name'))}
                placeholder=""
                value={c.firstName}
                onChange={(e: { target: { value: string } }) =>
                  setKids((x) =>
                    x.map((y, j) => (j === i ? { ...y, firstName: e.target.value } : y)),
                  )
                }
              />
              <SelectField
                label={t(k('f_age'))}
                value={c.ageBand}
                onValueChange={(a) =>
                  a &&
                  setKids((x) => x.map((y, j) => (j === i ? { ...y, ageBand: a as AgeBand } : y)))
                }
                options={AGE_BANDS.filter((a) => a !== 'adult').map((a) => ({
                  value: a,
                  label: t(k(`age_${a.replace('-', '_')}`)),
                }))}
              />
              <Button
                variant="secondary"
                className="reading-remove"
                aria-label={t(k('remove'))}
                onClick={() => setKids((x) => x.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={20} />
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setKids((x) => [...x, { firstName: '', ageBand: '6-9' }])}
            >
              <Icon name="plus" size={16} />
              {t(k('add_child'))}
            </Button>
          </div>
        </div>
      )}
      {form.fields.map((f) => (
        <AnswerField
          key={f.id}
          f={f}
          value={answers[f.id]}
          locale={locale}
          onChange={(x) => setAnswers((a) => ({ ...a, [f.id]: x }))}
        />
      ))}
      <div>
        <Button
          loading={save.isPending}
          disabled={!v.name.trim() || !phone || (form.forMinors && kids.length === 0)}
          onClick={() => save.mutate()}
        >
          {t(k('add_go'))}
        </Button>
      </div>
    </div>
  )
}

function AnswerField({
  f,
  value,
  locale,
  onChange,
}: {
  f: FormField
  value: string | string[] | boolean | undefined
  locale: string
  onChange: (v: string | string[] | boolean) => void
}) {
  const label = (locale === 'en' && f.labelEn) || f.labelFr
  const opts = f.options.map((o) => ({ value: o.fr, label: (locale === 'en' && o.en) || o.fr }))
  if (f.kind === 'yesno')
    return (
      <CheckboxField
        label={label}
        checked={value === true}
        onCheckedChange={(x: boolean) => onChange(x)}
      />
    )
  if (f.kind === 'choice')
    return (
      <SelectField
        label={label}
        value={typeof value === 'string' ? value : ''}
        placeholder="—"
        onValueChange={(x) => x && onChange(x)}
        options={opts}
      />
    )
  if (f.kind === 'multi') {
    const cur = Array.isArray(value) ? value : []
    return (
      <fieldset className="grid gap-1">
        <legend className="field-label">{label}</legend>
        {opts.map((o) => (
          <CheckboxField
            key={o.value}
            label={o.label}
            checked={cur.includes(o.value)}
            onCheckedChange={(x: boolean) =>
              onChange(x ? [...cur, o.value] : cur.filter((y) => y !== o.value))
            }
          />
        ))}
      </fieldset>
    )
  }
  return (
    <TextField
      label={label}
      placeholder=""
      value={typeof value === 'string' ? value : ''}
      onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
    />
  )
}

/* ── Check-in: one hand, names only ───────────────────────────────────── */
type CheckinRow = {
  id: string
  name: string
  partySize: number
  code: string
  checkedInAt: string | null
  children: { id: string; firstName: string; checkedInAt: string | null }[]
}
function Checkin({ id }: { id: string }) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const q = useQuery({
    queryKey: ['reg-checkin', id],
    queryFn: () =>
      api<{ title: string; items: CheckinRow[] }>(`/registrations/forms/${id}/checkin`),
  })
  // Optimistic: the tap shows at once and goes back if the network refuses (a bad connection is the normal case).
  const toggle = useMutation({
    mutationFn: (v: { id: string; present: boolean; personId?: string }) =>
      api(`/registrations/registrations/${v.id}`, {
        method: 'PATCH',
        body: {
          action: v.present ? 'checkin' : 'uncheckin',
          ...(v.personId ? { personId: v.personId } : {}),
        },
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['reg-checkin', id] })
      const before = qc.getQueryData<{ title: string; items: CheckinRow[] }>(['reg-checkin', id])
      const stamp = v.present ? new Date().toISOString() : null
      qc.setQueryData(
        ['reg-checkin', id],
        (d: typeof before) =>
          d && {
            ...d,
            items: d.items.map((r) =>
              r.id !== v.id
                ? r
                : v.personId
                  ? {
                      ...r,
                      children: r.children.map((c) =>
                        c.id === v.personId ? { ...c, checkedInAt: stamp } : c,
                      ),
                    }
                  : { ...r, checkedInAt: stamp },
            ),
          },
      )
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(['reg-checkin', id], ctx.before)
      say(t(k('error')), 'danger')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['reg-people', id] }),
  })
  const items = (q.data?.items ?? []).filter((r) =>
    r.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )
  const present = (q.data?.items ?? []).filter((r) => r.checkedInAt).length
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-muted">{t(k('checkin_help'))}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextField
          label={t(k('checkin_search'))}
          placeholder=""
          value={filter}
          onChange={(e: { target: { value: string } }) => setFilter(e.target.value)}
        />
        <strong>
          {t(k('checkin_count'), { n: String(present), total: String(q.data?.items.length ?? 0) })}
        </strong>
      </div>
      {q.data && q.data.items.length === 0 && <EmptyState title={t(k('people_empty_t'))} text="" />}
      <ul className="grid gap-2">
        {items.map((r) => (
          <li key={r.id} className="reg-checkin" data-present={r.checkedInAt ? '' : undefined}>
            <button
              type="button"
              className="reg-checkin-main"
              aria-pressed={!!r.checkedInAt}
              onClick={() => toggle.mutate({ id: r.id, present: !r.checkedInAt })}
            >
              <Icon name={r.checkedInAt ? 'check' : 'account'} size={24} />
              <span className="grid text-start">
                <strong>{r.name}</strong>
                <span className="text-sm text-ink-muted">
                  {t(k('party'), { n: String(r.partySize) })}
                </span>
              </span>
              <span className="reg-checkin-state">
                {t(k(r.checkedInAt ? 'present' : 'mark_present'))}
              </span>
            </button>
            {r.children.map((c) => (
              <button
                key={c.id}
                type="button"
                className="reg-checkin-child"
                aria-pressed={!!c.checkedInAt}
                onClick={() => toggle.mutate({ id: r.id, present: !c.checkedInAt, personId: c.id })}
              >
                <Icon name={c.checkedInAt ? 'check' : 'account'} size={20} />
                {c.firstName}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── The form itself ──────────────────────────────────────────────────── */
function FormEditor({
  form,
  canEdit,
  onChange,
}: {
  form: Form
  canEdit: boolean
  onChange: () => void
}) {
  const { t } = useLocale()
  const [v, setV] = useState(form)
  useEffect(() => setV(form), [form])
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setV((x) => ({ ...x, [key]: value }))
  const setField = (i: number, patch: Partial<FormField>) =>
    set(
      'fields',
      v.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    )
  const sensitive = v.fields.some((f) => looksSensitive(f.labelFr) || looksSensitive(f.labelEn))
  const optionsBad = v.fields.some(
    (f) => (f.kind === 'choice' || f.kind === 'multi') && f.options.length < 2,
  )
  const save = useMutation({
    mutationFn: (state?: 'draft' | 'published') =>
      api(`/registrations/forms/${form.id}`, {
        method: 'PATCH',
        body: {
          titleFr: v.titleFr,
          titleEn: v.titleEn,
          introFr: v.introFr,
          introEn: v.introEn,
          eventSlug: v.eventSlug ?? null,
          eventDate: v.eventDate,
          opensAt: v.opensAt,
          closesAt: v.closesAt,
          capacity: v.capacity,
          waitlist: v.waitlist,
          audience: v.audience,
          forMinors: v.forMinors,
          askWhatsapp: v.askWhatsapp,
          fields: v.fields,
          ...(state ? { state } : {}),
        },
      }).then(() => state),
    onSuccess: (state) => {
      say(
        t(
          k(
            state === 'published'
              ? 'form_published'
              : state === 'draft'
                ? 'form_unpublished'
                : 'form_saved',
          ),
        ),
      )
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const text = (
    key: 'titleFr' | 'titleEn' | 'introFr' | 'introEn',
    label: string,
    textarea = false,
  ) => (
    <TextField
      label={label}
      placeholder=""
      textarea={textarea}
      value={v[key]}
      disabled={!canEdit}
      onChange={(e: { target: { value: string } }) => set(key, e.target.value)}
    />
  )
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {text('titleFr', t(k('f_title_fr')))}
        {text('titleEn', t(k('f_title_en')))}
        {text('introFr', t(k('f_intro_fr')), true)}
        {text('introEn', t(k('f_intro_en')), true)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label={t(k('f_event_date'))}
          type="date"
          placeholder=""
          hint={t(k('f_event_date_help'))}
          value={v.eventDate}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('eventDate', e.target.value)}
        />
        <TextField
          label={t(k('f_opens'))}
          type="datetime-local"
          placeholder=""
          value={toLocalInput(v.opensAt)}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('opensAt', toIso(e.target.value))}
        />
        <TextField
          label={t(k('f_closes'))}
          type="datetime-local"
          placeholder=""
          value={toLocalInput(v.closesAt)}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('closesAt', toIso(e.target.value))}
        />
        <TextField
          label={t(k('f_capacity'))}
          type="number"
          min={1}
          placeholder="∞"
          hint={t(k('f_capacity_help'))}
          value={v.capacity == null ? '' : String(v.capacity)}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) =>
            set('capacity', e.target.value === '' ? null : Math.max(Number(e.target.value) || 1, 1))
          }
        />
        <TextField
          label={t(k('f_event_slug'))}
          placeholder=""
          hint={t(k('f_event_slug_help'))}
          value={v.eventSlug ?? ''}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) =>
            set('eventSlug', e.target.value.trim() || null)
          }
        />
        <SelectField
          label={t(k('f_audience'))}
          value={v.audience}
          onValueChange={(x) => x && set('audience', x as Form['audience'])}
          options={[
            { value: 'open', label: t(k('audience_open')) },
            { value: 'members', label: t(k('audience_members')) },
          ]}
        />
      </div>
      <div className="grid gap-2">
        <SwitchField
          label={t(k('f_waitlist'))}
          checked={v.waitlist}
          disabled={!canEdit}
          onCheckedChange={(x: boolean) => set('waitlist', x)}
        />
        <SwitchField
          label={t(k('f_minors'))}
          checked={v.forMinors}
          disabled={!canEdit}
          onCheckedChange={(x: boolean) => set('forMinors', x)}
        />
        {v.forMinors && <p className="text-sm text-ink-muted">{t(k('f_minors_help'))}</p>}
        <SwitchField
          label={t(k('f_ask_whatsapp'))}
          checked={v.askWhatsapp}
          disabled={!canEdit}
          onCheckedChange={(x: boolean) => set('askWhatsapp', x)}
        />
      </div>

      <section className="grid gap-3">
        <h3 className="text-lg">{t(k('f_fields'))}</h3>
        <p className="max-w-[70ch] text-sm text-ink-muted">{t(k('f_fields_help'))}</p>
        <p className="reg-always">{t(k('f_always'))}</p>
        {v.fields.map((f, i) => (
          <div
            key={f.id}
            className="reading-box"
            data-invalid={looksSensitive(f.labelFr) || looksSensitive(f.labelEn) ? '' : undefined}
          >
            <div className="reading-row">
              <div className="reading-kind">
                <SelectField
                  label={t(k('f_kind'))}
                  value={f.kind}
                  onValueChange={(x) => x && setField(i, { kind: x as FieldKind })}
                  options={FIELD_KINDS.map((x) => ({ value: x, label: t(k(`kind_${x}`)) }))}
                />
              </div>
              <div className="reading-book">
                <TextField
                  label={t(k('f_label_fr'))}
                  placeholder=""
                  value={f.labelFr}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setField(i, { labelFr: e.target.value })
                  }
                />
              </div>
              <div className="reading-book">
                <TextField
                  label={t(k('f_label_en'))}
                  placeholder=""
                  value={f.labelEn}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) =>
                    setField(i, { labelEn: e.target.value })
                  }
                />
              </div>
              {canEdit && (
                <Button
                  variant="secondary"
                  className="reading-remove"
                  aria-label={t(k('remove'))}
                  onClick={() =>
                    set(
                      'fields',
                      v.fields.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Icon name="close" size={20} />
                </Button>
              )}
            </div>
            {(f.kind === 'choice' || f.kind === 'multi') && (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={t(k('f_options_fr'))}
                  hint={t(k('f_options_help'))}
                  placeholder=""
                  textarea
                  value={f.options.map((o) => o.fr).join('\n')}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => {
                    const fr = e.target.value.split('\n')
                    setField(i, {
                      options: fr.map((x, n) => ({ fr: x, en: f.options[n]?.en ?? '' })),
                    })
                  }}
                />
                <TextField
                  label={t(k('f_options_en'))}
                  placeholder=""
                  textarea
                  value={f.options.map((o) => o.en).join('\n')}
                  disabled={!canEdit}
                  onChange={(e: { target: { value: string } }) => {
                    const en = e.target.value.split('\n')
                    setField(i, { options: f.options.map((o, n) => ({ ...o, en: en[n] ?? '' })) })
                  }}
                />
              </div>
            )}
            <CheckboxField
              label={t(k('f_required'))}
              checked={f.required}
              disabled={!canEdit}
              onCheckedChange={(x: boolean) => setField(i, { required: x })}
            />
            {(looksSensitive(f.labelFr) || looksSensitive(f.labelEn)) && (
              <p className="field-error" role="alert">
                {t(k('f_sensitive'))}
              </p>
            )}
          </div>
        ))}
        {canEdit && v.fields.length < 8 && (
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                set('fields', [
                  ...v.fields,
                  {
                    id: newId(),
                    kind: 'text',
                    labelFr: '',
                    labelEn: '',
                    required: false,
                    options: [],
                  },
                ])
              }
            >
              <Icon name="plus" size={16} />
              {t(k('f_add_field'))}
            </Button>
          </div>
        )}
      </section>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            loading={save.isPending}
            disabled={
              !v.titleFr.trim() ||
              !v.eventDate ||
              sensitive ||
              optionsBad ||
              v.fields.some((f) => !f.labelFr.trim())
            }
            onClick={() => save.mutate(undefined)}
          >
            {t(k('save'))}
          </Button>
          <Button
            variant={form.state === 'published' ? 'secondary' : 'primary'}
            disabled={save.isPending || sensitive || optionsBad}
            onClick={() => save.mutate(form.state === 'published' ? 'draft' : 'published')}
          >
            {t(k(form.state === 'published' ? 'unpublish' : 'publish'))}
          </Button>
        </div>
      )}
    </div>
  )
}
