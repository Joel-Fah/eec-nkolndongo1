/**
 * Fête des Moissons (admin, /m/campaigns): the campaigns, the amounts received (entered by the treasurer, validated by someone
 * else: only validated totals reach the public page), and an optional goal per group, shown as encouragement.
 */
import { api, DateField, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog, CoverField } from '@eec/content-kit'
import type { MessageKey } from '@eec/i18n'
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
import { useEffect, useState } from 'react'
import { percentOf, xaf } from './rules.ts'

type Campaign = {
  id: string
  slug: string
  state: 'draft' | 'published'
  titleFr: string
  titleEn: string
  descriptionFr: string
  descriptionEn: string
  startsOn: string
  endsOn: string
  goalXaf: number
  coverMediaId: string | null
  raised: number
  pending: { amount: number; entries: number }
  percent: number
  goals?: { groupId: string; goalXaf: number; raised: number }[]
}
type Entry = {
  id: string
  amountXaf: number
  receivedOn: string
  groupId: string | null
  groupName: string | null
  note: string
  validated: boolean
  validatedAt: string | null
  createdBy: string | null
}
type Group = { id: string; nameFr: string; nameEn: string | null }

const k = (key: string) => `campaigns.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
const dayText = (d: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${d}T12:00:00Z`))

export default function CampaignsPage() {
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
  return openId ? <CampaignView id={openId} onBack={() => open(null)} /> : <List onOpen={open} />
}

function Meter({ raised, goal }: { raised: number; goal: number }) {
  const pct = percentOf(raised, goal)
  return (
    <span className="camp-meter" role="img" aria-label={`${pct} %`}>
      <span style={{ width: `${Math.min(pct, 100)}%` }} />
    </span>
  )
}

/* ── The campaigns ────────────────────────────────────────────────────── */
function List({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<{ items: Campaign[] }>('/campaigns'),
  })
  const create = useMutation({
    mutationFn: async () => {
      // The dates start from the Moissons range set in Settings, if there is one.
      const s = await api<{ season?: { moissonsStart?: string; moissonsEnd?: string } }>(
        '/settings/public',
      ).catch(() => ({}) as { season?: { moissonsStart?: string; moissonsEnd?: string } })
      const y = new Date().getFullYear()
      return api<{ id: string }>('/campaigns', {
        method: 'POST',
        body: {
          titleFr: t(k('new_title'), { year: String(y) }),
          startsOn: s.season?.moissonsStart || `${y}-11-01`,
          endsOn: s.season?.moissonsEnd || `${y}-11-08`,
        },
      })
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
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
        {hasPermission(me, 'campaigns:edit') && (
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            <Icon name="plus" size={20} />
            {t(k('new'))}
          </Button>
        )}
      </header>
      {list.data && items.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
      ) : (
        <ul className="admin-grid-3">
          {items.map((c) => (
            <li key={c.id}>
              <button type="button" className="admin-panel plan-tile" onClick={() => onOpen(c.id)}>
                <Badge tone={c.state === 'published' ? 'success' : 'warning'}>
                  {t(k(`state_${c.state}`))}
                </Badge>
                <strong className="font-display text-2xl">
                  {(locale === 'en' && c.titleEn) || c.titleFr}
                </strong>
                <span className="text-sm text-ink-muted">
                  {dayText(c.startsOn, locale)} → {dayText(c.endsOn, locale)}
                </span>
                <Meter raised={c.raised} goal={c.goalXaf} />
                <span className="text-sm">
                  {t(k('raised_of'), { a: xaf(c.raised), b: xaf(c.goalXaf), p: String(c.percent) })}
                </span>
                {c.pending.entries > 0 && (
                  <Badge tone="warning">{t(k('pending'), { n: String(c.pending.entries) })}</Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── One campaign ─────────────────────────────────────────────────────── */
function CampaignView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const q = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api<Campaign>(`/campaigns/${id}`),
  })
  const c = q.data
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['campaign', id] })
    qc.invalidateQueries({ queryKey: ['campaign-progress', id] })
    qc.invalidateQueries({ queryKey: ['campaigns'] })
  }
  const del = useMutation({
    mutationFn: () => api(`/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('deleted')))
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      onBack()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  if (q.isError) return <EmptyState title={t(k('empty_t'))} text="" />
  if (!c) return <div className="admin-panel" aria-busy="true" />
  const canEdit = hasPermission(me, 'campaigns:edit')
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
          <Badge tone={c.state === 'published' ? 'success' : 'warning'}>
            {t(k(`state_${c.state}`))}
          </Badge>
          <h1 className="text-4xl">{(locale === 'en' && c.titleEn) || c.titleFr}</h1>
          <p className="text-ink-muted">
            {dayText(c.startsOn, locale)} → {dayText(c.endsOn, locale)}
          </p>
        </div>
        {hasPermission(me, 'campaigns:delete') && (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {t(k('delete'))}
          </Button>
        )}
      </header>
      <section className="admin-panel grid gap-2" aria-label={t(k('totals'))}>
        <p className="font-display text-3xl">{xaf(c.raised)}</p>
        <Meter raised={c.raised} goal={c.goalXaf} />
        <p className="text-sm text-ink-muted">
          {t(k('raised_of'), { a: xaf(c.raised), b: xaf(c.goalXaf), p: String(c.percent) })}
        </p>
        {c.pending.entries > 0 && (
          <p className="camp-pending">
            <Icon name="alert" size={16} />
            {t(k('pending_long'), { n: String(c.pending.entries), a: xaf(c.pending.amount) })}
          </p>
        )}
        <p className="text-sm text-ink-muted">{t(k('public_help'))}</p>
      </section>
      <TabsBox
        tabs={[
          {
            id: 'amounts',
            label: t(k('tab_amounts')),
            content: <Amounts campaign={c} onChange={refresh} />,
          },
          {
            id: 'groups',
            label: t(k('tab_groups')),
            content: <Goals campaign={c} canEdit={canEdit} onChange={refresh} />,
          },
          {
            id: 'form',
            label: t(k('tab_form')),
            content: <Form campaign={c} canEdit={canEdit} onChange={refresh} />,
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

/* ── Amounts received ─────────────────────────────────────────────────── */
function useGroups() {
  return useQuery({
    queryKey: ['groups-light'],
    queryFn: () => api<{ groups: Group[] }>('/groups'),
    staleTime: 60_000,
  })
}

function Amounts({ campaign, onChange }: { campaign: Campaign; onChange: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const canEnter = hasPermission(me, 'campaigns:progress')
  const canValidate = hasPermission(me, 'campaigns:validate')
  const groups = useGroups()
  const q = useQuery({
    queryKey: ['campaign-progress', campaign.id],
    queryFn: () => api<{ items: Entry[] }>(`/campaigns/${campaign.id}/progress`),
  })
  const [v, setV] = useState({ amount: '', date: today(), groupId: '', note: '' })
  const [drop, setDrop] = useState<Entry | null>(null)
  const add = useMutation({
    mutationFn: () =>
      api(`/campaigns/${campaign.id}/progress`, {
        method: 'POST',
        body: {
          amountXaf: Number(v.amount.replace(/\D/g, '')),
          receivedOn: v.date,
          groupId: v.groupId || null,
          note: v.note,
        },
      }),
    onSuccess: () => {
      setV((x) => ({ ...x, amount: '', note: '' }))
      say(t(k('entry_added')))
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const validate = useMutation({
    mutationFn: (x: { id: string; validated: boolean }) =>
      api(`/campaigns/progress/${x.id}/validate`, {
        method: 'POST',
        body: { validated: x.validated },
      }),
    onSuccess: onChange,
    onError: (e) =>
      say(t(k((e as { code?: string }).code === 'own_entry' ? 'own_entry' : 'error')), 'danger'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api(`/campaigns/progress/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDrop(null)
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const amount = Number(v.amount.replace(/\D/g, ''))
  return (
    <div className="grid gap-4">
      {canEnter && (
        <div className="admin-panel grid gap-3">
          <h2 className="text-xl">{t(k('add_h'))}</h2>
          <p className="text-sm text-ink-muted">{t(k('add_help'))}</p>
          <div className="reg-grid reg-grid-3">
            <TextField
              label={t(k('f_amount'))}
              placeholder="50 000"
              inputMode="numeric"
              hint={amount ? xaf(amount) : undefined}
              value={v.amount}
              onChange={(e: { target: { value: string } }) =>
                setV((x) => ({ ...x, amount: e.target.value }))
              }
            />
            <DateField
              label={t(k('f_date'))}
              max={today()}
              value={v.date}
              onChange={(v: string) => setV((x) => ({ ...x, date: v }))}
            />
            <SelectField
              label={t(k('f_group'))}
              value={v.groupId || 'none'}
              onValueChange={(x) => setV((y) => ({ ...y, groupId: !x || x === 'none' ? '' : x }))}
              options={[
                { value: 'none', label: t(k('no_group')) },
                ...(groups.data?.groups ?? []).map((g) => ({
                  value: g.id,
                  label: (locale === 'en' && g.nameEn) || g.nameFr,
                })),
              ]}
            />
            <TextField
              label={t(k('f_note'))}
              placeholder=""
              maxLength={120}
              hint={t(k('f_note_help'))}
              value={v.note}
              onChange={(e: { target: { value: string } }) =>
                setV((x) => ({ ...x, note: e.target.value }))
              }
            />
          </div>
          <div>
            <Button
              loading={add.isPending}
              disabled={!amount || !v.date}
              onClick={() => add.mutate()}
            >
              {t(k('add_go'))}
            </Button>
          </div>
        </div>
      )}
      {q.data && q.data.items.length === 0 ? (
        <EmptyState title={t(k('entries_empty_t'))} text={t(k('entries_empty_p'))} />
      ) : (
        <ul className="grid gap-2">
          {(q.data?.items ?? []).map((e) => (
            <li
              key={e.id}
              className="admin-panel reg-row"
              data-status={e.validated ? 'ok' : 'wait'}
            >
              <div className="grid gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-lg">{xaf(e.amountXaf)}</strong>
                  <Badge tone={e.validated ? 'success' : 'warning'}>
                    {t(k(e.validated ? 'validated' : 'not_validated'))}
                  </Badge>
                  <span className="text-sm text-ink-muted">
                    {dayText(e.receivedOn, locale)}
                    {e.groupName ? ` · ${e.groupName}` : ''}
                  </span>
                </span>
                {e.note && <span className="text-sm text-ink-muted">{e.note}</span>}
              </div>
              <div className="flex flex-wrap items-start gap-1">
                {canValidate && (
                  <Button
                    size="sm"
                    variant={e.validated ? 'ghost' : 'secondary'}
                    loading={validate.isPending}
                    onClick={() => validate.mutate({ id: e.id, validated: !e.validated })}
                  >
                    {t(k(e.validated ? 'unvalidate' : 'validate'))}
                  </Button>
                )}
                {canEnter && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t(k('delete_entry'))}
                    onClick={() => setDrop(e)}
                  >
                    <Icon name="trash" size={16} />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!drop}
        onClose={() => setDrop(null)}
        title={t(k('delete_entry_t'))}
        text={t(k('delete_entry_p'))}
        confirmLabel={t(k('delete_entry'))}
        danger
        busy={del.isPending}
        onConfirm={() => drop && del.mutate(drop.id)}
      />
    </div>
  )
}

/* ── Group goals: encouragement, never a ranking ──────────────────────── */
function Goals({
  campaign,
  canEdit,
  onChange,
}: {
  campaign: Campaign
  canEdit: boolean
  onChange: () => void
}) {
  const { t, locale } = useLocale()
  const groups = useGroups()
  const [pick, setPick] = useState('')
  const [goal, setGoal] = useState('')
  const name = (id: string) => {
    const g = groups.data?.groups.find((x) => x.id === id)
    return g ? (locale === 'en' && g.nameEn) || g.nameFr : id
  }
  const save = useMutation({
    mutationFn: (x: { groupId: string; goalXaf: number }) =>
      api(`/campaigns/${campaign.id}/groups/${x.groupId}`, {
        method: 'PUT',
        body: { goalXaf: x.goalXaf },
      }),
    onSuccess: () => {
      setPick('')
      setGoal('')
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const drop = useMutation({
    mutationFn: (groupId: string) =>
      api(`/campaigns/${campaign.id}/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: onChange,
  })
  const used = new Set((campaign.goals ?? []).map((g) => g.groupId))
  return (
    <div className="grid gap-4">
      <p className="max-w-[70ch] text-sm text-ink-muted">{t(k('goals_help'))}</p>
      {(campaign.goals ?? []).length === 0 && (
        <p className="text-ink-muted">{t(k('goals_none'))}</p>
      )}
      <ul className="grid gap-2">
        {(campaign.goals ?? []).map((g) => (
          <li key={g.groupId} className="admin-panel reg-row">
            <div className="grid gap-1">
              <strong>{name(g.groupId)}</strong>
              <Meter raised={g.raised} goal={g.goalXaf} />
              <span className="text-sm text-ink-muted">
                {xaf(g.raised)} / {xaf(g.goalXaf)}
              </span>
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={t(k('remove'))}
                onClick={() => drop.mutate(g.groupId)}
              >
                <Icon name="close" size={16} />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="admin-panel reg-grid reg-grid-2">
          <SelectField
            label={t(k('f_group'))}
            value={pick}
            placeholder={t(k('pick_group'))}
            onValueChange={(x) => x && setPick(x)}
            options={(groups.data?.groups ?? [])
              .filter((g) => !used.has(g.id))
              .map((g) => ({ value: g.id, label: (locale === 'en' && g.nameEn) || g.nameFr }))}
          />
          <TextField
            label={t(k('f_goal'))}
            placeholder="500 000"
            inputMode="numeric"
            value={goal}
            onChange={(e: { target: { value: string } }) => setGoal(e.target.value)}
          />
          <div>
            <Button
              disabled={!pick || !Number(goal.replace(/\D/g, ''))}
              loading={save.isPending}
              onClick={() =>
                save.mutate({ groupId: pick, goalXaf: Number(goal.replace(/\D/g, '')) })
              }
            >
              {t(k('goal_add'))}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── The campaign itself ──────────────────────────────────────────────── */
function Form({
  campaign,
  canEdit,
  onChange,
}: {
  campaign: Campaign
  canEdit: boolean
  onChange: () => void
}) {
  const { t } = useLocale()
  const [v, setV] = useState(campaign)
  useEffect(() => setV(campaign), [campaign])
  const set = <K extends keyof Campaign>(key: K, value: Campaign[K]) =>
    setV((x) => ({ ...x, [key]: value }))
  const save = useMutation({
    mutationFn: (state?: 'draft' | 'published') =>
      api(`/campaigns/${campaign.id}`, {
        method: 'PATCH',
        body: {
          titleFr: v.titleFr,
          titleEn: v.titleEn,
          descriptionFr: v.descriptionFr,
          descriptionEn: v.descriptionEn,
          startsOn: v.startsOn,
          endsOn: v.endsOn,
          goalXaf: v.goalXaf,
          coverMediaId: v.coverMediaId,
          ...(state ? { state } : {}),
        },
      }).then(() => state),
    onSuccess: (state) => {
      say(
        t(k(state === 'published' ? 'published_t' : state === 'draft' ? 'unpublished_t' : 'saved')),
      )
      onChange()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const field = (
    key: 'titleFr' | 'titleEn' | 'descriptionFr' | 'descriptionEn',
    label: string,
    area = false,
  ) => (
    <TextField
      label={label}
      placeholder=""
      textarea={area}
      value={v[key]}
      disabled={!canEdit}
      onChange={(e: { target: { value: string } }) => set(key, e.target.value)}
    />
  )
  return (
    <div className="grid gap-5">
      <div className="reg-grid reg-grid-2">
        {field('titleFr', t(k('f_title_fr')))}
        {field('titleEn', t(k('f_title_en')))}
        {field('descriptionFr', t(k('f_desc_fr')), true)}
        {field('descriptionEn', t(k('f_desc_en')), true)}
      </div>
      <div className="reg-grid reg-grid-3">
        <DateField
          label={t(k('f_starts'))}
          value={v.startsOn}
          disabled={!canEdit}
          onChange={(v: string) => set('startsOn', v)}
        />
        <DateField
          label={t(k('f_ends'))}
          value={v.endsOn}
          disabled={!canEdit}
          onChange={(v: string) => set('endsOn', v)}
        />
        <TextField
          label={t(k('f_goal'))}
          placeholder="5 000 000"
          inputMode="numeric"
          hint={v.goalXaf ? xaf(v.goalXaf) : undefined}
          value={v.goalXaf ? String(v.goalXaf) : ''}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) =>
            set('goalXaf', Number(e.target.value.replace(/\D/g, '')) || 0)
          }
        />
      </div>
      <CoverField mediaId={v.coverMediaId} onChange={(id) => set('coverMediaId', id)} />
      {canEdit && (
        <div className="reg-actions">
          <Button
            variant="secondary"
            disabled={save.isPending || !v.goalXaf}
            onClick={() => save.mutate(campaign.state === 'published' ? 'draft' : 'published')}
          >
            {t(k(campaign.state === 'published' ? 'unpublish' : 'publish'))}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!v.titleFr.trim() || !v.startsOn || !v.endsOn || v.startsOn > v.endsOn}
            onClick={() => save.mutate(undefined)}
          >
            {t(k('save'))}
          </Button>
        </div>
      )}
    </div>
  )
}
