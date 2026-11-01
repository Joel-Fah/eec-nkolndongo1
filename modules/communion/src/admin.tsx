/**
 * Communion cards (admin, /m/communion). Five tabs, each for one job: Cartes (the month's work: visa, contributions, status), Nouvelle
 * carte (confirm a baptism, propose a card), Cotisations attendues (what each age band and group is expected to give), Vérifier une
 * carte (the scanner) and Aide (what every tab, status and action means, with scenarios). Each part appears only to people who hold its right;
 * the API is the authority.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  EmptyState,
  MenuButton,
  SelectField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

const k = (key: string) => `communion.${key}` as MessageKey
const notify = (title: string, tone: 'success' | 'error' = 'success') =>
  toastManager.add({ title, data: { tone } })

type State = 'proposed' | 'valid' | 'expired' | 'suspended' | 'withdrawn'
type Row = {
  id: string
  userId: string
  name: string
  status: string
  state: State
  validUntil: string
  proposedBy: string | null
  visa: boolean
  excused: boolean
  amount: number | null
}
type Cards = {
  month: string
  sunday: string
  prep: { from: string; to: string }
  mayRegister: boolean
  items: Row[]
}
const TONE = {
  valid: 'success',
  proposed: 'gold',
  expired: 'warning',
  suspended: 'danger',
  withdrawn: 'info',
} as const
const STATES: State[] = ['proposed', 'valid', 'suspended', 'expired', 'withdrawn']
const BANDS = ['under18', '18-25', '26-35', '36-50', '51-65', 'over65']

const monthOptions = () => {
  const now = new Date()
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export default function Communion() {
  const { t } = useLocale()
  const me = useMe().data
  const can = (p: string) => hasPermission(me, `communion:${p}`)
  const tabs = [
    can('read') && { id: 'cards', label: t(k('tab_cards')), content: <CardsTab /> },
    can('issue') && { id: 'new', label: t(k('tab_new')), content: <NewTab /> },
    can('read') && {
      id: 'fees',
      label: t(k('tab_fees')),
      content: <FeesTab canEdit={can('fees')} />,
    },
    can('verify') && { id: 'check', label: t(k('tab_check')), content: <CheckTab /> },
  ].filter(Boolean) as { id: string; label: string; content: React.ReactNode }[]
  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="text-3xl">{t(k('title'))}</h1>
        <p className="max-w-[62ch] text-ink-muted">{t(k('lead'))}</p>
      </header>
      <TabsBox tabs={tabs} />
    </div>
  )
}

function StateBadge({ state }: { state: State }) {
  const { t } = useLocale()
  return <Badge tone={TONE[state]}>{t(k(`state_${state}`))}</Badge>
}

function CardsTab() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const can = (p: string) => hasPermission(me, `communion:${p}`)
  const qc = useQueryClient()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const list = useQuery({
    queryKey: ['communion', 'cards', month, q],
    queryFn: () =>
      api<Cards>(
        `/communion/cards?month=${month}${q.length >= 2 ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['communion', 'cards'] })
  const [ask, setAsk] = useState<{ row: Row; kind: 'withdraw' | 'suspend' | 'renew' } | null>(null)
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState(`${new Date().getFullYear() + 1}-12-31`)
  const act = useMutation({
    mutationFn: (v: { path: string; method?: string; body?: unknown }) =>
      api(v.path, { method: v.method ?? 'POST', body: v.body ?? {} }),
    onSuccess: () => {
      notify(t(k('done')))
      setAsk(null)
      setReason('')
      void refresh()
    },
    onError: (e) =>
      notify(
        (e as { code?: string }).code === 'second_person_required'
          ? t(k('second_person'))
          : t(k('error')),
        'error',
      ),
  })
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const data = list.data
  const items = (data?.items ?? []).filter((r) => filter === 'all' || r.state === filter)
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(`${iso}T12:00:00Z`),
    )
  const count = (st: State) => (data?.items ?? []).filter((r) => r.state === st).length
  return (
    <div className="grid gap-4">
      <div className="cm-filters">
        <SelectField
          label={t(k('month'))}
          value={month}
          onValueChange={(v) => v && setMonth(v)}
          options={monthOptions().map((m) => ({
            value: m,
            label: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
              new Date(`${m}-01T12:00:00Z`),
            ),
          }))}
        />
        <SelectField
          label={t(k('status'))}
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          options={[
            { value: 'all', label: `${t(k('all'))} (${data?.items.length ?? 0})` },
            ...STATES.map((st) => ({ value: st, label: `${t(k(`state_${st}`))} (${count(st)})` })),
          ]}
        />
        <TextField
          label={t(k('search'))}
          placeholder={t(k('search_ph'))}
          value={q}
          onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
        />
      </div>
      {data && (
        <p className="cm-month">
          {t(k('sunday_is'), { date: day(data.sunday) })} ·{' '}
          {t(k('prep_is'), { from: day(data.prep.from), to: day(data.prep.to) })}
        </p>
      )}
      {data && !items.length && <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />}
      <ul className="cm-list">
        {items.map((r) => {
          const menu = [
            can('suspend') &&
              r.state === 'valid' && {
                id: 'suspend',
                label: t(k('suspend')),
                onSelect: () => setAsk({ row: r, kind: 'suspend' }),
              },
            can('approve') &&
              (r.state === 'valid' || r.state === 'expired') && {
                id: 'renew',
                label: t(k('renew')),
                onSelect: () => setAsk({ row: r, kind: 'renew' }),
              },
            can('approve') &&
              r.state !== 'withdrawn' && {
                id: 'withdraw',
                label: t(k('withdraw')),
                onSelect: () => setAsk({ row: r, kind: 'withdraw' }),
              },
          ].filter(Boolean) as { id: string; label: string; onSelect: () => void }[]
          return (
            <li key={r.id} className="cm-row" data-state={r.state}>
              <div className="cm-who">
                <strong>{r.name}</strong>
                <span className="cm-meta">
                  <StateBadge state={r.state} />
                  {r.excused && <Badge tone="info">{t(k('excused'))}</Badge>}
                  <span>{t(k('until_short'), { date: r.validUntil })}</span>
                </span>
              </div>
              <div className="cm-cell">
                <span className="cm-label">{t(k('col_visa'))}</span>
                <div className="cm-inline">
                  {r.state === 'valid' ? (
                    <>
                      <Badge tone={r.visa ? 'success' : 'warning'}>
                        {r.visa ? t(k('visa_done')) : t(k('visa_not'))}
                      </Badge>
                      {can('visa') && (
                        <Button
                          size="sm"
                          variant={r.visa ? 'secondary' : 'primary'}
                          onClick={() =>
                            act.mutate({
                              path: `/communion/cards/${r.id}/visa`,
                              method: 'PUT',
                              body: { month, signed: !r.visa },
                            })
                          }
                        >
                          {r.visa ? t(k('unvisa')) : t(k('visa'))}
                        </Button>
                      )}
                    </>
                  ) : (
                    <span className="cm-dash">—</span>
                  )}
                </div>
              </div>
              {data?.mayRegister && (
                <div className="cm-cell">
                  <label className="cm-label" htmlFor={`amt-${r.id}`}>
                    {t(k('amount'))}
                  </label>
                  <div className="cm-inline">
                    <input
                      id={`amt-${r.id}`}
                      className="input cm-input"
                      inputMode="numeric"
                      placeholder="0"
                      value={amounts[r.id] ?? (r.amount ?? '').toString()}
                      disabled={!can('register-write')}
                      onChange={(e) =>
                        setAmounts({ ...amounts, [r.id]: e.target.value.replace(/\D/g, '') })
                      }
                    />
                    {can('register-write') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          act.mutate({
                            path: `/communion/cards/${r.id}/contribution`,
                            method: 'PUT',
                            body: {
                              month,
                              amountXaf:
                                (amounts[r.id] ?? '') === '' ? null : Number(amounts[r.id]),
                            },
                          })
                        }
                      >
                        {t(k('note'))}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="cm-actions">
                {can('approve') && r.state === 'proposed' && (
                  <Button
                    size="sm"
                    onClick={() => act.mutate({ path: `/communion/cards/${r.id}/approve` })}
                  >
                    {t(k('approve'))}
                  </Button>
                )}
                {can('suspend') && r.state === 'suspended' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => act.mutate({ path: `/communion/cards/${r.id}/restore` })}
                  >
                    {t(k('restore'))}
                  </Button>
                )}
                {menu.length > 0 && (
                  <MenuButton
                    label={t(k('more'))}
                    items={menu}
                    className="btn btn-secondary btn-sm"
                  />
                )}
              </div>
              {ask?.row.id === r.id && (
                <fieldset className="cm-ask" aria-label={t(k(ask.kind))}>
                  <strong>{t(k(ask.kind))}</strong>
                  <p className="text-ink-muted">{t(k(`${ask.kind}_p`))}</p>
                  {ask.kind === 'withdraw' && (
                    <TextField
                      label={t(k('reason'))}
                      placeholder={t(k('reason_ph'))}
                      value={reason}
                      onChange={(e: { target: { value: string } }) => setReason(e.target.value)}
                    />
                  )}
                  {ask.kind === 'renew' && (
                    <TextField
                      label={t(k('until'))}
                      placeholder="2027-12-31"
                      value={until}
                      onChange={(e: { target: { value: string } }) => setUntil(e.target.value)}
                    />
                  )}
                  <div className="cm-inline">
                    <Button
                      size="sm"
                      variant={ask.kind === 'withdraw' ? 'danger' : 'primary'}
                      loading={act.isPending}
                      disabled={ask.kind === 'withdraw' && reason.trim().length < 3}
                      onClick={() =>
                        act.mutate({
                          path: `/communion/cards/${r.id}/${ask.kind}`,
                          body:
                            ask.kind === 'withdraw'
                              ? { reason }
                              : ask.kind === 'renew'
                                ? { validUntil: until }
                                : {},
                        })
                      }
                    >
                      {t(k(ask.kind))}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setAsk(null)}>
                      {t(k('cancel'))}
                    </Button>
                  </div>
                </fieldset>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type Person = {
  id: string
  name: string
  email: string
  phone: string | null
  neighbourhood: string | null
  city: string | null
  joinedAt: string
  baptised: boolean | null
  confirmed: boolean | null
  confirmedAt: string | null
  cardStatus: string | null
}
function NewTab() {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const people = useQuery({
    queryKey: ['communion', 'people', q.trim().length >= 2 ? q.trim() : ''],
    queryFn: () =>
      api<{ mode: 'search' | 'pending'; items: Person[] }>(
        `/communion/people${q.trim().length >= 2 ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
      ),
  })
  const act = useMutation({
    mutationFn: (v: { path: string; method?: string; body: unknown }) =>
      api(v.path, { method: v.method ?? 'POST', body: v.body }),
    onSuccess: () => {
      notify(t(k('done')))
      void qc.invalidateQueries({ queryKey: ['communion'] })
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const items = people.data?.items ?? []
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(iso))
  return (
    <div className="grid gap-4">
      <TextField
        label={t(k('search'))}
        hint={t(k('search_hint'))}
        placeholder={t(k('search_ph'))}
        value={q}
        onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
      />
      <h2 className="text-xl">
        {people.data?.mode === 'search'
          ? t(k('results'))
          : t(k('pending_title'), { n: String(items.length) })}
      </h2>
      {people.data?.mode === 'pending' && <p className="text-ink-muted">{t(k('pending_p'))}</p>}
      {people.isSuccess && !items.length && (
        <EmptyState
          title={people.data?.mode === 'search' ? t(k('no_result')) : t(k('pending_empty_t'))}
          text={people.data?.mode === 'search' ? undefined : t(k('pending_empty_p'))}
        />
      )}
      <ul className="cm-list">
        {items.map((p) => {
          const step = p.cardStatus ? (p.cardStatus === 'proposed' ? 3 : 4) : p.confirmedAt ? 2 : 1
          return (
            <li key={p.id} className="cm-row cm-person">
              <div className="cm-who">
                <strong>{p.name}</strong>
                <span className="cm-meta">
                  <span>{p.email}</span>
                  {p.phone && <span>{p.phone}</span>}
                  {(p.neighbourhood || p.city) && (
                    <span>{[p.neighbourhood, p.city].filter(Boolean).join(', ')}</span>
                  )}
                  <span>{t(k('member_since'), { date: when(p.joinedAt) })}</span>
                </span>
                <span className="cm-meta">
                  {p.baptised && <Badge tone="info">{t(k('declared_baptised'))}</Badge>}
                  {p.confirmed && <Badge tone="info">{t(k('declared_confirmed'))}</Badge>}
                  {!p.baptised && !p.confirmed && <span>{t(k('not_declared'))}</span>}
                </span>
              </div>
              <ol className="cm-steps" aria-label={t(k('steps'))}>
                {[1, 2, 3].map((n) => (
                  <li
                    key={n}
                    data-done={step > n ? '' : undefined}
                    data-now={step === n ? '' : undefined}
                  >
                    {t(k(`step_${n}`))}
                  </li>
                ))}
              </ol>
              <div className="cm-actions">
                {p.cardStatus ? (
                  <Badge tone="info">
                    {t(k(p.cardStatus === 'proposed' ? 'waiting_approval' : 'has_card'))}
                  </Badge>
                ) : p.confirmedAt ? (
                  <Button
                    size="sm"
                    onClick={() => act.mutate({ path: '/communion/cards', body: { userId: p.id } })}
                  >
                    {t(k('propose'))}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      act.mutate({
                        path: `/communion/sacrament/${p.id}`,
                        method: 'PUT',
                        body: { confirmed: true },
                      })
                    }
                  >
                    {t(k('confirm_baptism'))}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FeesTab({ canEdit }: { canEdit: boolean }) {
  const { t, locale } = useLocale()
  const qc = useQueryClient()
  const fees = useQuery({
    queryKey: ['communion', 'fees'],
    queryFn: () =>
      api<{
        items: { kind: string; key: string; amountXaf: number }[]
        groups: { id: string; nameFr: string; nameEn: string | null }[]
      }>('/communion/fees'),
  })
  const [draft, setDraft] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: (v: { kind: string; key: string; amountXaf: number | null }) =>
      api('/communion/fees', { method: 'PUT', body: v }),
    onSuccess: () => {
      notify(t(k('done')))
      void qc.invalidateQueries({ queryKey: ['communion', 'fees'] })
    },
    onError: () => notify(t(k('error')), 'error'),
  })
  const value = (kind: string, key: string) =>
    draft[`${kind}:${key}`] ??
    (fees.data?.items.find((f) => f.kind === kind && f.key === key)?.amountXaf ?? '').toString()
  const row = (kind: 'age' | 'group', key: string, label: string) => (
    <li key={`${kind}:${key}`} className="cm-row cm-fee">
      <div className="cm-who">
        <strong>{label}</strong>
      </div>
      <div className="cm-cell">
        <label className="cm-label" htmlFor={`fee-${kind}-${key}`}>
          {t(k('amount'))}
        </label>
        <div className="cm-inline">
          <input
            id={`fee-${kind}-${key}`}
            className="input cm-input"
            inputMode="numeric"
            placeholder="0"
            value={value(kind, key)}
            disabled={!canEdit}
            onChange={(e) =>
              setDraft({ ...draft, [`${kind}:${key}`]: e.target.value.replace(/\D/g, '') })
            }
          />
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                save.mutate({
                  kind,
                  key,
                  amountXaf: value(kind, key) === '' ? null : Number(value(kind, key)),
                })
              }
            >
              {t(k('save'))}
            </Button>
          )}
        </div>
      </div>
    </li>
  )
  return (
    <div className="grid gap-4">
      <h2 className="text-xl">{t(k('fees_age'))}</h2>
      <ul className="cm-list">
        {BANDS.map((b) => row('age', b, t(`members.age_${b}` as MessageKey)))}
      </ul>
      <h2 className="text-xl">{t(k('fees_group'))}</h2>
      <ul className="cm-list">
        {(fees.data?.groups ?? []).map((g) =>
          row('group', g.id, (locale === 'en' && g.nameEn) || g.nameFr),
        )}
      </ul>
    </div>
  )
}

/** The scanner: the phone's camera reads the QR code when the browser can (BarcodeDetector); otherwise the address is pasted. */
function CheckTab() {
  const { t } = useLocale()
  const video = useRef<HTMLVideoElement>(null)
  const [token, setToken] = useState('')
  const [result, setResult] = useState<{
    state: string
    until: string | null
    name: string | null
  } | null>(null)
  const [camera, setCamera] = useState(false)
  const check = useMutation({
    mutationFn: (raw: string) => {
      let tk = raw.trim()
      try {
        tk = new URL(tk).searchParams.get('t') ?? tk
      } catch {
        // not an address: it is the token itself
      }
      return api<{ state: string; until: string | null; name: string | null }>(
        `/communion/check/${encodeURIComponent(tk)}`,
      )
    },
    onSuccess: (r) => setResult(r),
    onError: () => notify(t(k('error')), 'error'),
  })
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window
  useEffect(() => {
    if (!camera) return
    let stop = false
    let stream: MediaStream | undefined
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (video.current) {
          video.current.srcObject = stream
          await video.current.play()
        }
        // biome-ignore lint/suspicious/noExplicitAny: BarcodeDetector is not in the TypeScript DOM types yet
        const det = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        while (!stop) {
          const found = video.current ? await det.detect(video.current) : []
          if (found[0]?.rawValue) {
            setCamera(false)
            check.mutate(found[0].rawValue)
            break
          }
          await new Promise((r) => setTimeout(r, 400))
        }
      } catch {
        setCamera(false)
        notify(t(k('camera_error')), 'error')
      }
    })()
    return () => {
      stop = true
      for (const x of stream?.getTracks() ?? []) x.stop()
    }
  }, [camera])
  return (
    <div className="grid gap-3">
      {supported && (
        <Button
          onClick={() => {
            setResult(null)
            setCamera((c) => !c)
          }}
        >
          {camera ? t(k('camera_stop')) : t(k('camera_start'))}
        </Button>
      )}
      {camera && (
        <video
          ref={video}
          muted
          playsInline
          className="w-full max-w-md rounded-lg"
          aria-label={t(k('camera_label'))}
        />
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setResult(null)
          check.mutate(token)
        }}
      >
        <TextField
          label={t(k('paste'))}
          placeholder="https://…/verifier/…"
          value={token}
          onChange={(e: { target: { value: string } }) => setToken(e.target.value)}
        />
        <Button type="submit" loading={check.isPending}>
          {t(k('check'))}
        </Button>
      </form>
      {result && (
        <div className="admin-panel grid gap-1" role="status">
          <Badge tone={result.state === 'valid' ? 'success' : 'danger'}>
            {t(k(`check_${result.state}`))}
          </Badge>
          {result.name && <strong className="text-2xl">{result.name}</strong>}
          {result.until && result.state === 'valid' && (
            <span className="text-ink-muted">{t(k('valid_until'), { date: result.until })}</span>
          )}
        </div>
      )}
    </div>
  )
}
