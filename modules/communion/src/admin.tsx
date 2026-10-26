/**
 * Communion cards (admin, /m/communion): the cards and the month's visa (Elders), the contributions register, proposing a card (secretariat)
 * and approving it (a second person), the expected-fee schedule (treasurer) and the scanner check. Each part appears only to people who
 * hold its right; the API is the authority.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
  Button,
  EmptyState,
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

type Row = {
  id: string
  userId: string
  name: string
  status: string
  state: 'proposed' | 'valid' | 'expired' | 'suspended' | 'withdrawn'
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
      {tabs.length ? <TabsBox tabs={tabs} /> : <EmptyState title={t(k('no_access'))} />}
    </div>
  )
}

function CardsTab() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const can = (p: string) => hasPermission(me, `communion:${p}`)
  const qc = useQueryClient()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [q, setQ] = useState('')
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
        String(
          (e as { code?: string }).code === 'second_person_required'
            ? t(k('second_person'))
            : t(k('error')),
        ),
        'error',
      ),
  })
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const data = list.data
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(`${iso}T12:00:00Z`),
    )
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
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
        <TextField
          label={t(k('search'))}
          placeholder={t(k('search_ph'))}
          value={q}
          onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
        />
      </div>
      {data && (
        <p className="text-ink-muted">
          {t(k('sunday_is'), { date: day(data.sunday) })} ·{' '}
          {t(k('prep_is'), { from: day(data.prep.from), to: day(data.prep.to) })}
        </p>
      )}
      {data && !data.items.length && <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />}
      <ul className="grid gap-2">
        {(data?.items ?? []).map((r) => (
          <li key={r.id} className="admin-panel grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{r.name}</strong>
              <span className="flex items-center gap-2">
                {r.excused && <Badge tone="info">{t(k('excused'))}</Badge>}
                <Badge tone={TONE[r.state]}>{t(k(`state_${r.state}`))}</Badge>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {can('visa') && r.state === 'valid' && (
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
              {!can('visa') && r.visa && <Badge tone="success">{t(k('visa_done'))}</Badge>}
              {data?.mayRegister && (
                <span className="flex items-end gap-2">
                  <TextField
                    label={t(k('amount'))}
                    placeholder="5000"
                    inputMode="numeric"
                    value={amounts[r.id] ?? (r.amount ?? '').toString()}
                    onChange={(e: { target: { value: string } }) =>
                      setAmounts({ ...amounts, [r.id]: e.target.value.replace(/\D/g, '') })
                    }
                    disabled={!can('register-write')}
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
                            amountXaf: (amounts[r.id] ?? '') === '' ? null : Number(amounts[r.id]),
                          },
                        })
                      }
                    >
                      {t(k('note'))}
                    </Button>
                  )}
                </span>
              )}
              {can('approve') && r.state === 'proposed' && (
                <Button
                  size="sm"
                  onClick={() => act.mutate({ path: `/communion/cards/${r.id}/approve` })}
                >
                  {t(k('approve'))}
                </Button>
              )}
              {can('suspend') && r.state === 'valid' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAsk({ row: r, kind: 'suspend' })}
                >
                  {t(k('suspend'))}
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
              {can('approve') && (r.state === 'valid' || r.state === 'expired') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAsk({ row: r, kind: 'renew' })}
                >
                  {t(k('renew'))}
                </Button>
              )}
              {can('approve') && r.state !== 'withdrawn' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAsk({ row: r, kind: 'withdraw' })}
                >
                  {t(k('withdraw'))}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {ask && (
        <fieldset className="admin-panel grid gap-3" aria-label={t(k(ask.kind))}>
          <strong>{`${t(k(ask.kind))} : ${ask.row.name}`}</strong>
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
          <div className="flex gap-2">
            <Button
              variant={ask.kind === 'withdraw' ? 'danger' : 'primary'}
              loading={act.isPending}
              disabled={ask.kind === 'withdraw' && reason.trim().length < 3}
              onClick={() =>
                act.mutate({
                  path: `/communion/cards/${ask.row.id}/${ask.kind}`,
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
            <Button variant="secondary" onClick={() => setAsk(null)}>
              {t(k('cancel'))}
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  )
}

type Person = {
  id: string
  name: string
  baptised: boolean | null
  confirmed: boolean | null
  confirmedAt: string | null
  cardStatus: string | null
}
function NewTab() {
  const { t } = useLocale()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const people = useQuery({
    queryKey: ['communion', 'people', q],
    enabled: q.trim().length >= 2,
    queryFn: () => api<{ items: Person[] }>(`/communion/people?q=${encodeURIComponent(q.trim())}`),
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
  return (
    <div className="grid gap-3">
      <p className="text-ink-muted">{t(k('new_p'))}</p>
      <TextField
        label={t(k('search'))}
        placeholder={t(k('search_ph'))}
        value={q}
        onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
      />
      <ul className="grid gap-2">
        {(people.data?.items ?? []).map((p) => (
          <li key={p.id} className="admin-panel flex flex-wrap items-center justify-between gap-2">
            <div className="grid">
              <strong>{p.name}</strong>
              <span className="text-sm text-ink-muted">
                {p.baptised ? t(k('declared_baptised')) : t(k('not_declared'))}
                {p.confirmed ? ` · ${t(k('declared_confirmed'))}` : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.cardStatus ? (
                <Badge tone="info">{t(k('has_card'))}</Badge>
              ) : p.confirmedAt ? (
                <>
                  <Badge tone="success">{t(k('baptism_confirmed'))}</Badge>
                  <Button
                    size="sm"
                    onClick={() => act.mutate({ path: '/communion/cards', body: { userId: p.id } })}
                  >
                    {t(k('propose'))}
                  </Button>
                </>
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
        ))}
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
    <li
      key={`${kind}:${key}`}
      className="admin-panel flex flex-wrap items-end justify-between gap-2"
    >
      <span>{label}</span>
      <span className="flex items-end gap-2">
        <TextField
          label={t(k('amount'))}
          placeholder="5000"
          inputMode="numeric"
          value={value(kind, key)}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) =>
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
      </span>
    </li>
  )
  return (
    <div className="grid gap-3">
      <p className="text-ink-muted">{t(k('fees_p'))}</p>
      <h2 className="text-xl">{t(k('fees_age'))}</h2>
      <ul className="grid gap-2">
        {BANDS.map((b) => row('age', b, t(`members.age_${b}` as MessageKey)))}
      </ul>
      <h2 className="text-xl">{t(k('fees_group'))}</h2>
      <ul className="grid gap-2">
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
      const tk = raw.trim().split('/').pop()?.split('?')[0] ?? ''
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
      <p className="text-ink-muted">{t(k('check_p'))}</p>
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
