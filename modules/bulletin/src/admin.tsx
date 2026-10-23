/**
 * Bulletin (admin, /m/bulletin): « Composer le bulletin de dimanche » (pick the Sunday, start from the site's own data, from last
 * week's bulletin, or empty), then edit the blocks (title and lines in French and English), reorder, publish. Autosave.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { ConfirmDialog, SaveIndicator, useAutosave } from '@eec/content-kit'
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
import { useEffect, useRef, useState } from 'react'
import { type Assembled, assemble } from './assemble.ts'
import type { BlockKind, BulletinBlock, BulletinItem } from './schema.ts'

type Row = {
  id: string
  weekOf: string
  state: 'draft' | 'published'
  titleFr: string
  blocks: number
}
type Full = {
  id: string
  weekOf: string
  state: 'draft' | 'published'
  titleFr: string
  titleEn: string
  blocks: BulletinBlock[]
  pdfUrl: string
}
type Draft = { titleFr: string; titleEn: string; blocks: BulletinBlock[]; pdfUrl: string }

const k = (key: string) => `bulletin.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
/** The parts filled from the site's own data: chosen from what exists, never typed here. */
const SOURCED = ['sunday', 'agenda', 'meditations', 'announcements'] as const
const SOURCE_PATH: Record<(typeof SOURCED)[number], string> = {
  sunday: '/m/liturgy',
  agenda: '/m/events',
  meditations: '/m/meditations',
  announcements: '/m/news',
}
/** The same line: by the record it came from, or (older bulletins, no key) by its text. */
const sameItem = (a: BulletinItem, b: BulletinItem) =>
  a.key && b.key ? a.key === b.key : a.titleFr === b.titleFr && a.textFr === b.textFr
const newId = () => Math.random().toString(36).slice(2, 10)
const sundays = () => {
  const now = new Date()
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
      ((7 - now.getUTCDay()) % 7) * 86_400_000,
  )
  return Array.from({ length: 10 }, (_, i) =>
    new Date(next.getTime() + (i - 3) * 7 * 86_400_000).toISOString().slice(0, 10),
  )
}
const longDate = (d: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${d}T12:00:00Z`))
const urlOk = (v: string) => v.trim() === '' || /^https:\/\/[^\s/]+\.[^\s/]+/i.test(v.trim())

export default function BulletinPage() {
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
  return openId ? <Editor id={openId} onBack={() => open(null)} /> : <List onOpen={open} />
}

/* ── List + compose ───────────────────────────────────────────────────── */
function List({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['bulletins'],
    queryFn: () => api<{ items: Row[] }>('/bulletin'),
  })
  const weeks = sundays()
  const coming = weeks[3] as string
  const [week, setWeek] = useState(coming)
  const [mode, setMode] = useState<'assemble' | 'copy' | 'blank'>('assemble')
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T12:00:00Z`))
  const existing = list.data?.items.find((b) => b.weekOf === week)
  const previous = list.data?.items.find((b) => b.weekOf < week)
  const create = useMutation({
    mutationFn: async () => {
      let blocks: BulletinBlock[] | undefined
      if (mode === 'assemble') blocks = (await assemble(week)).blocks
      return api<{ id: string }>('/bulletin', {
        method: 'POST',
        body: {
          weekOf: week,
          ...(blocks ? { blocks } : {}),
          ...(mode === 'copy' && previous ? { copyFrom: previous.weekOf } : {}),
        },
      })
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['bulletins'] })
      onOpen(r.id)
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  return (
    <div className="grid gap-6">
      <header className="grid max-w-[62ch] gap-2">
        <h1 className="text-4xl">{t(k('title'))}</h1>
        <p className="text-ink-muted">{t(k('lead'))}</p>
      </header>
      {hasPermission(me, 'bulletin:edit') && (
        <div className="admin-panel grid gap-3">
          <h2 className="text-xl">{t(k('compose'))}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t(k('compose_week'))}
              value={week}
              onValueChange={(v) => v && setWeek(v)}
              options={weeks.map((w) => ({ value: w, label: fmt(w) }))}
            />
            <SelectField
              label=" "
              value={mode}
              onValueChange={(v) => v && setMode(v as typeof mode)}
              options={[
                { value: 'assemble', label: t(k('compose_assemble')) },
                ...(previous ? [{ value: 'copy', label: t(k('compose_copy')) }] : []),
                { value: 'blank', label: t(k('compose_blank')) },
              ]}
            />
          </div>
          {existing ? (
            <p className="flex flex-wrap items-center gap-3">
              <span className="text-ink-muted">{t(k('exists_t'))}</span>
              <Button variant="secondary" size="sm" onClick={() => onOpen(existing.id)}>
                {t(k('exists_open'))}
              </Button>
            </p>
          ) : (
            <div>
              <Button loading={create.isPending} onClick={() => create.mutate()}>
                {t(k('compose_go'))}
              </Button>
            </div>
          )}
        </div>
      )}
      {list.data && list.data.items.length === 0 ? (
        <EmptyState title={t(k('empty_t'))} text={t(k('empty_p'))} />
      ) : (
        <ul className="grid gap-2">
          {(list.data?.items ?? []).map((b) => (
            <li key={b.id}>
              <button type="button" className="admin-row news-row" onClick={() => onOpen(b.id)}>
                <span className="grid text-start">
                  <strong>{t(k('week_of'), { date: longDate(b.weekOf, locale) })}</strong>
                  <span className="text-sm text-ink-muted">
                    {t(k('blocks_count'), { n: String(b.blocks) })}
                  </span>
                </span>
                <Badge tone={b.state === 'published' ? 'success' : 'warning'}>
                  {t(k(`status_${b.state}`))}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── Editor ───────────────────────────────────────────────────────────── */
function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canEdit = hasPermission(me, 'bulletin:edit')
  const canPublish = hasPermission(me, 'bulletin:publish')
  const canDelete = hasPermission(me, 'bulletin:delete')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [meta, setMeta] = useState<Full | null>(null)
  const saved = useRef<Draft | null>(null)
  const [confirm, setConfirm] = useState<null | 'delete'>(null)
  const [busy, setBusy] = useState(false)
  // What the site holds for this week: the only things a bulletin can be built from.
  const [source, setSource] = useState<Assembled | 'error' | null>(null)

  const load = async () => {
    const r = await api<Full>(`/bulletin/${id}`)
    const d: Draft = { titleFr: r.titleFr, titleEn: r.titleEn, blocks: r.blocks, pdfUrl: r.pdfUrl }
    saved.current = d
    setDraft(d)
    setMeta(r)
    autosave.reset(d)
  }
  const autosave = useAutosave<Draft>(draft, async (v) => {
    if (!urlOk(v.pdfUrl)) return
    const before = saved.current
    const patch: Record<string, unknown> = {}
    for (const key of Object.keys(v) as (keyof Draft)[])
      if (!before || JSON.stringify(v[key]) !== JSON.stringify(before[key])) patch[key] = v[key]
    if (Object.keys(patch).length === 0) return
    await api(`/bulletin/${id}`, { method: 'PATCH', body: patch })
    saved.current = v
    qc.invalidateQueries({ queryKey: ['bulletins'] })
  })
  useEffect(() => {
    load().catch(() => {
      say(t(k('error')), 'danger')
      onBack()
    })
  }, [id])
  const weekOf = meta?.weekOf
  const readSource = async () => {
    if (!weekOf) return
    setSource(await assemble(weekOf).catch(() => 'error' as const))
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once per week
  useEffect(() => {
    readSource()
  }, [weekOf])
  const state = useMutation({
    mutationFn: async (to: 'publish' | 'unpublish') => {
      await autosave.flush()
      await api(`/bulletin/${id}/${to}`, { method: 'POST' })
      return to
    },
    onSuccess: async (to) => {
      say(t(k(to === 'publish' ? 'published_t' : 'unpublished_t')))
      await load()
      qc.invalidateQueries({ queryKey: ['bulletins'] })
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const del = useMutation({
    mutationFn: () => api(`/bulletin/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('deleted')))
      qc.invalidateQueries({ queryKey: ['bulletins'] })
      onBack()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  if (!draft || !meta) return <div className="admin-panel" aria-busy="true" />
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  const setBlock = (i: number, patch: Partial<BulletinBlock>) =>
    set(
      'blocks',
      draft.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    )
  const move = (i: number, by: -1 | 1) => {
    const j = i + by
    if (j < 0 || j >= draft.blocks.length) return
    const next = [...draft.blocks]
    ;[next[i], next[j]] = [next[j] as BulletinBlock, next[i] as BulletinBlock]
    set('blocks', next)
  }
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T12:00:00Z`))
  const srcBlock = (kind: BlockKind) =>
    source && source !== 'error' ? source.blocks.find((b) => b.kind === kind) : undefined
  /** Re-reads the site, then rewrites the chosen lines with their current text (the choice itself is kept). */
  const refresh = async () => {
    setBusy(true)
    try {
      const a = await assemble(meta.weekOf)
      setSource(a)
      set(
        'blocks',
        draft.blocks.flatMap((b) => {
          if (b.kind === 'text') return [b]
          const items = (a.blocks.find((x) => x.kind === b.kind)?.items ?? []).filter((x) =>
            b.items.some((y) => sameItem(x, y)),
          )
          return items.length ? [{ ...b, items }] : []
        }),
      )
      say(t(k('refreshed')))
    } catch {
      say(t(k('error')), 'danger')
    } finally {
      setBusy(false)
    }
  }
  const toggle = (kind: (typeof SOURCED)[number], it: BulletinItem, on: boolean) => {
    const src = srcBlock(kind)
    const existing = draft.blocks.find((b) => b.kind === kind)
    const order = src?.items ?? []
    const items = on
      ? [...(existing?.items ?? []), it]
      : (existing?.items ?? []).filter((x) => !sameItem(x, it))
    const rank = (x: BulletinItem) => {
      const n = order.findIndex((y) => sameItem(x, y))
      return n === -1 ? 99 : n
    }
    items.sort((x, y) => rank(x) - rank(y))
    if (existing)
      set(
        'blocks',
        items.length
          ? draft.blocks.map((b) => (b === existing ? { ...b, items } : b))
          : draft.blocks.filter((b) => b !== existing),
      )
    else if (items.length)
      set('blocks', [
        ...draft.blocks,
        {
          id: newId(),
          kind,
          titleFr: src?.titleFr ?? t(k(`kind_${kind}`)),
          titleEn: src?.titleEn ?? '',
          items,
        },
      ])
  }
  // The stored parts first (in their order), then the site's other parts, which are empty until a line is chosen.
  const sections = [
    ...draft.blocks.map((block, index) => ({
      block: block as BulletinBlock | null,
      kind: block.kind,
      index,
    })),
    ...SOURCED.filter((kd) => !draft.blocks.some((b) => b.kind === kd)).map((kind) => ({
      block: null as BulletinBlock | null,
      kind: kind as BlockKind,
      index: -1,
    })),
  ]
  const rangeText = (() => {
    const f = (d: string) =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${d}T12:00:00Z`))
    const end = new Date(Date.parse(`${meta.weekOf}T12:00:00Z`) + 6 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    return t(k('range'), { from: f(meta.weekOf), to: f(end) })
  })()
  const renderSource = (kind: (typeof SOURCED)[number], b: BulletinBlock | null, i: number) => {
    const src = srcBlock(kind)
    const stored = b?.items ?? []
    const stale = stored.filter((x) => !(src?.items ?? []).some((y) => sameItem(x, y)))
    const line = (it: BulletinItem) => {
      const en = locale === 'en'
      const title = (en && it.titleEn) || it.titleFr
      const text = (en && it.textEn) || it.textFr
      return [title, text].filter(Boolean).join(' — ')
    }
    return (
      <section
        key={b?.id ?? kind}
        className="admin-panel grid gap-3"
        aria-label={t(k(`kind_${kind}`))}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{t(k(`kind_${kind}`))}</Badge>
            <Badge tone="info">{t(k('from_site'))}</Badge>
          </span>
          {canEdit && b && (
            <span className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t(k('move_up'))}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <Icon name="chevronUp" size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t(k('move_down'))}
                disabled={i === draft.blocks.length - 1}
                onClick={() => move(i, 1)}
              >
                <Icon name="chevronDown" size={16} />
              </Button>
            </span>
          )}
        </div>
        {kind === 'agenda' && <p className="text-sm text-ink-muted">{rangeText}</p>}
        {source === null ? (
          <p className="text-sm text-ink-muted" aria-busy="true">
            {t(k('assemble_busy'))}
          </p>
        ) : source === 'error' ? (
          <p className="text-sm text-danger">{t(k('source_error'))}</p>
        ) : (src?.items.length ?? 0) === 0 && stale.length === 0 ? (
          <div className="bulletin-nodata">
            <p>{t(k(`nodata_${kind}`))}</p>
            <a className="btn btn-secondary" href={SOURCE_PATH[kind]}>
              {t(k(`nodata_open_${kind}`))}
              <Icon name="arrowRight" size={16} />
            </a>
          </div>
        ) : (
          <div className="grid gap-1">
            {(src?.items ?? []).map((it) => (
              <CheckboxField
                key={it.key ?? line(it)}
                label={line(it)}
                checked={stored.some((x) => sameItem(x, it))}
                disabled={!canEdit}
                onCheckedChange={(v: boolean) => toggle(kind, it, v)}
              />
            ))}
            {stale.map((it) => (
              <CheckboxField
                key={`stale-${it.key ?? line(it)}`}
                label={`${line(it)} (${t(k('stale'))})`}
                checked
                disabled={!canEdit}
                onCheckedChange={(v: boolean) => toggle(kind, it, v)}
              />
            ))}
          </div>
        )}
      </section>
    )
  }
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => autosave.flush().finally(onBack)}>
          <Icon name="chevronLeft" size={20} />
          {t(k('back'))}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator state={autosave.state} />
          <Badge tone={meta.state === 'published' ? 'success' : 'warning'}>
            {t(k(`status_${meta.state}`))}
          </Badge>
        </div>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-4xl">{t(k('week_of'), { date: longDate(meta.weekOf, locale) })}</h1>
        <div className="flex flex-wrap gap-2">
          {canPublish && (
            <Button
              variant={meta.state === 'published' ? 'secondary' : 'primary'}
              loading={state.isPending}
              onClick={() => state.mutate(meta.state === 'published' ? 'unpublish' : 'publish')}
            >
              {t(k(meta.state === 'published' ? 'unpublish' : 'publish'))}
            </Button>
          )}
          {meta.state === 'published' && (
            <a
              className="btn btn-secondary"
              href={`/${locale}/${locale === 'fr' ? 'actualites/meditations-et-bulletin' : 'news/meditations-and-bulletin'}/bulletin/${meta.weekOf}/`}
              target="_blank"
              rel="noreferrer"
            >
              {t(k('view_site'))}
              <Icon name="external" size={16} />
            </a>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => setConfirm('delete')}>
              {t(k('delete'))}
            </Button>
          )}
        </div>
      </header>

      {canEdit && (
        <div className="admin-panel grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[60ch] text-sm text-ink-muted">{t(k('assemble_help'))}</p>
            <Button variant="secondary" loading={busy} onClick={refresh}>
              {t(k(busy ? 'assemble_busy' : 'assemble'))}
            </Button>
          </div>
        </div>
      )}

      <div className="admin-panel grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t(k('title_fr'))}
            placeholder=""
            value={draft.titleFr}
            disabled={!canEdit}
            onChange={(e: { target: { value: string } }) => set('titleFr', e.target.value)}
          />
          <TextField
            label={t(k('title_en'))}
            placeholder=""
            value={draft.titleEn}
            disabled={!canEdit}
            onChange={(e: { target: { value: string } }) => set('titleEn', e.target.value)}
          />
        </div>
        <TextField
          label={t(k('pdf'))}
          placeholder="https://…"
          hint={urlOk(draft.pdfUrl) ? t(k('pdf_help')) : t(k('pdf_bad'))}
          value={draft.pdfUrl}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set('pdfUrl', e.target.value)}
        />
      </div>

      {sections.map(({ block: b, kind, index: i }) =>
        kind !== 'text' || !b ? (
          renderSource(kind as (typeof SOURCED)[number], b, i)
        ) : (
          <section key={b.id} className="admin-panel grid gap-3" aria-label={b.titleFr}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge>{t(k(`kind_${b.kind}`))}</Badge>
              {canEdit && (
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t(k('move_up'))}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <Icon name="chevronUp" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t(k('move_down'))}
                    disabled={i === draft.blocks.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <Icon name="chevronDown" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t(k('remove_block'))}
                    onClick={() =>
                      set(
                        'blocks',
                        draft.blocks.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Icon name="close" size={16} />
                  </Button>
                </span>
              )}
            </div>
            <TabsBox
              tabs={(['Fr', 'En'] as const).map((l) => ({
                id: l,
                label: l === 'Fr' ? 'Français' : 'English',
                content: (
                  <div className="grid gap-3">
                    {l === 'En' && <p className="text-sm text-ink-muted">{t(k('en_note'))}</p>}
                    <TextField
                      label={t(k(l === 'Fr' ? 'block_title_fr' : 'block_title_en'))}
                      placeholder=""
                      value={b[`title${l}`]}
                      disabled={!canEdit}
                      onChange={(e: { target: { value: string } }) =>
                        setBlock(i, { [`title${l}`]: e.target.value } as Partial<BulletinBlock>)
                      }
                    />
                    {b.items.map((it, n) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: edited in place
                      <div key={n} className="reading-box">
                        <div className="link-row" data-other="">
                          <TextField
                            label={t(k(l === 'Fr' ? 'item_title_fr' : 'item_title_en'))}
                            placeholder=""
                            value={it[`title${l}`]}
                            disabled={!canEdit}
                            onChange={(e: { target: { value: string } }) =>
                              setBlock(i, {
                                items: b.items.map((x, j) =>
                                  j === n ? { ...x, [`title${l}`]: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <TextField
                            label={t(k(l === 'Fr' ? 'item_text_fr' : 'item_text_en'))}
                            placeholder=""
                            value={it[`text${l}`]}
                            disabled={!canEdit}
                            onChange={(e: { target: { value: string } }) =>
                              setBlock(i, {
                                items: b.items.map((x, j) =>
                                  j === n ? { ...x, [`text${l}`]: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <Button
                            variant="secondary"
                            className="reading-remove"
                            aria-label={t(k('remove_item'))}
                            onClick={() =>
                              setBlock(i, { items: b.items.filter((_, j) => j !== n) })
                            }
                          >
                            <Icon name="close" size={20} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />
            {canEdit && (
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setBlock(i, {
                      items: [
                        ...b.items,
                        { titleFr: '', titleEn: '', textFr: '', textEn: '' } satisfies BulletinItem,
                      ],
                    })
                  }
                >
                  {t(k('add_item'))}
                </Button>
              </div>
            )}
          </section>
        ),
      )}

      {canEdit && draft.blocks.length < 12 && (
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              set('blocks', [
                ...draft.blocks,
                {
                  id: newId(),
                  kind: 'text',
                  titleFr: t(k('kind_text')),
                  titleEn: '',
                  items: [{ titleFr: '', titleEn: '', textFr: '', textEn: '' }],
                },
              ])
            }
          >
            <Icon name="plus" size={16} />
            {t(k('add_text'))}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
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
