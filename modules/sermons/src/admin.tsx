/**
 * Sermons (admin, /m/sermons): the list, the series, and the editor — title, summary, notes in French and English, date,
 * preacher (with the consent box), series, passages, a YouTube video and links (any https address). Nothing is uploaded:
 * the site hosts no audio (decision 0034). Autosave, a plain « Publier » dialog, earlier versions and preview links.
 */
import { api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import {
  ConfirmDialog,
  CoverField,
  PublishDialog,
  RevisionsDrawer,
  SaveIndicator,
  StatusBadge,
  useAutosave,
  ViewToggle,
} from '@eec/content-kit'
import {
  type BibleRef,
  BOOKS,
  compareVerses,
  type Doc,
  EMPTY_DOC,
  formatRef,
  publishProblems,
  type Status,
  shortDate,
} from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Button,
  EmptyState,
  Icon,
  SelectField,
  SwitchField,
  TabsBox,
  TextField,
  toastManager,
} from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const RichTextEditor = lazy(() => import('@eec/content-kit/editor'))

type Item = {
  id: string
  slug: string
  status: Status
  seriesId: string | null
  seriesTitle: string | null
  publishAt: string | null
  unpublishAt: string | null
  titleFr: string
  titleEn: string
  preachedOn: string | null
  preacherName: string
  updatedAt: string
}
type LinkKind = (typeof LINK_KINDS)[number]
const LINK_KINDS = ['audio', 'notes', 'slides', 'other'] as const
type Link = { kind?: LinkKind; label: string; url: string }
type Full = Item & {
  summaryFr: string
  summaryEn: string
  bodyFr: Doc
  bodyEn: Doc
  transcript: Doc
  preacherConsent: boolean
  refs: BibleRef[]
  youtubeId: string
  links: Link[]
  coverMediaId: string | null
  sundayDate: string | null
}
type Draft = {
  titleFr: string
  titleEn: string
  summaryFr: string
  summaryEn: string
  bodyFr: Doc
  bodyEn: Doc
  transcript: Doc
  preachedOn: string | null
  seriesId: string | null
  preacherName: string
  preacherConsent: boolean
  refs: BibleRef[]
  youtube: string
  links: Link[]
  coverMediaId: string | null
  sundayDate: string | null
  slug: string
}
type Series = {
  id: string
  titleFr: string
  titleEn: string
  descriptionFr: string
  descriptionEn: string
  count: number
}

const k = (key: string) => `sermons.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })
const key_count = (o: object) => Object.keys(o).length
const verseInput = (raw: string): string | number | null => {
  const v = raw
    .toLowerCase()
    .replace(/[^0-9a-z]/g, '')
    .replace(/^(\d{0,3})(\d*)([a-z]?).*$/, '$1$3')
  if (!/^\d/.test(v)) return null
  return /^\d+$/.test(v) ? Number(v) : v
}
const youtubeOk = (v: string) =>
  v.trim() === '' ||
  /^[\w-]{11}$/.test(v.trim()) ||
  /(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(v)
const urlOk = (v: string) => /^https:\/\/[^\s/]+\.[^\s/]+/i.test(v.trim())

export default function SermonsPage() {
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
  return openId ? <Editor id={openId} onBack={() => open(null)} /> : <Home onOpen={open} />
}

/* ── List + series ────────────────────────────────────────────────────── */
function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useLocale()
  return (
    <div className="grid gap-6">
      <header className="grid max-w-[62ch] gap-2">
        <h1 className="text-4xl">{t(k('title'))}</h1>
        <p className="text-ink-muted">{t(k('lead'))}</p>
      </header>
      <TabsBox
        tabs={[
          { id: 'sermons', label: t(k('tab_sermons')), content: <List onOpen={onOpen} /> },
          { id: 'series', label: t(k('tab_series')), content: <SeriesList /> },
        ]}
      />
    </div>
  )
}

const VIEW_KEY = 'eec-sermons-view'

function List({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [view, setViewState] = useState<'list' | 'grid'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
    } catch {
      return 'list'
    }
  })
  const setView = (v: 'list' | 'grid') => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {}
  }
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const list = useQuery({
    queryKey: ['sermons', params.toString()],
    queryFn: () => api<{ items: Item[]; counts: Record<Status, number> }>(`/sermons?${params}`),
  })
  const create = useMutation({
    mutationFn: (body: object = {}) => api<{ id: string }>('/sermons', { method: 'POST', body }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['sermons'] })
      onOpen(r.id)
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const counts = list.data?.counts
  const filtered = !!(q || status || from || to)
  // Grouped by the month it was preached (or last edited, for a sermon with no date yet), newest first.
  const groups = new Map<string, Item[]>()
  for (const n of list.data?.items ?? []) {
    const key = (n.preachedOn ?? n.updatedAt).slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), n])
  }
  const monthName = (ym: string) => {
    const name = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${ym}-01T00:00:00Z`))
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  const dateOf = (n: Item) =>
    n.preachedOn
      ? shortDate(`${n.preachedOn}T12:00:00Z`, locale)
      : t(k('updated'), { date: shortDate(n.updatedAt, locale) })
  const meta = (n: Item) =>
    `${dateOf(n)}${n.seriesTitle ? ` · ${n.seriesTitle}` : ''}${
      n.status === 'scheduled' && n.publishAt
        ? ` · ${t(k('scheduled_for'), { date: shortDate(n.publishAt, locale) })}`
        : ''
    }`
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <TextField
            label={t(k('search'))}
            placeholder={t(k('search_ph'))}
            icon="search"
            type="search"
            value={q}
            onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
          />
        </div>
        <div className="media-select">
          <SelectField
            label={t(k('filter'))}
            value={status || 'all'}
            onValueChange={(v) => setStatus(!v || v === 'all' ? '' : v)}
            options={[
              { value: 'all', label: t(k('all')) },
              ...(['draft', 'scheduled', 'published', 'archived'] as const).map((s) => ({
                value: s,
                label: `${t(`content.status.${s}`)}${counts ? ` (${counts[s]})` : ''}`,
              })),
            ]}
          />
        </div>
        <TextField
          label={t(k('date_from'))}
          type="date"
          placeholder=""
          value={from}
          onChange={(e: { target: { value: string } }) => setFrom(e.target.value)}
        />
        <TextField
          label={t(k('date_to'))}
          type="date"
          placeholder=""
          value={to}
          onChange={(e: { target: { value: string } }) => setTo(e.target.value)}
        />
        <ViewToggle
          value={view}
          onChange={setView}
          label={t(k('view'))}
          options={[
            { id: 'list', label: t(k('view_list')), icon: 'layoutList' },
            { id: 'grid', label: t(k('view_grid')), icon: 'gridView' },
          ]}
        />
        {hasPermission(me, 'sermons:edit') && (
          <Button loading={create.isPending} onClick={() => create.mutate({})}>
            {t(k('write'))}
          </Button>
        )}
      </div>
      {list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={t(k(filtered ? 'empty_filter_t' : 'empty_t'))}
          text={t(k(filtered ? 'empty_filter_p' : 'empty_p'))}
        />
      ) : (
        [...groups.entries()].map(([ym, items]) => (
          <section key={ym} className="grid gap-3" aria-label={monthName(ym)}>
            <h2 className="sermon-month">
              {monthName(ym)}
              <span>{items.length}</span>
            </h2>
            {view === 'list' ? (
              <ul className="grid gap-2">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="admin-row news-row"
                      onClick={() => onOpen(n.id)}
                    >
                      <span className="grid text-start">
                        <strong>{n.titleFr || t(k('untitled'))}</strong>
                        <span className="text-sm text-ink-muted">{meta(n)}</span>
                      </span>
                      <StatusBadge status={n.status} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="admin-panel sermon-tile"
                      onClick={() => onOpen(n.id)}
                    >
                      <StatusBadge status={n.status} />
                      <strong className="font-display text-xl">
                        {n.titleFr || t(k('untitled'))}
                      </strong>
                      <span className="text-sm text-ink-muted">{meta(n)}</span>
                      {n.preacherName && <span className="text-sm">{n.preacherName}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  )
}

function SeriesList() {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['sermon-series'],
    queryFn: () => api<{ items: Series[] }>('/sermons/series'),
  })
  const canEdit = hasPermission(me, 'sermons:edit')
  const canDelete = hasPermission(me, 'sermons:delete')
  const [editing, setEditing] = useState<Series | 'new' | null>(null)
  const [removing, setRemoving] = useState<Series | null>(null)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['sermon-series'] })
    qc.invalidateQueries({ queryKey: ['sermons'] })
  }
  const del = useMutation({
    mutationFn: (id: string) => api(`/sermons/series/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRemoving(null)
      refresh()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  return (
    <div className="grid gap-4">
      <p className="text-ink-muted">{t(k('series_lead'))}</p>
      {canEdit && !editing && (
        <div>
          <Button onClick={() => setEditing('new')}>{t(k('series_new'))}</Button>
        </div>
      )}
      {editing && (
        <SeriesForm
          key={editing === 'new' ? 'new' : editing.id}
          series={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {q.data && q.data.items.length === 0 && !editing ? (
        <EmptyState title={t(k('series_empty_t'))} text={t(k('series_empty_p'))} />
      ) : (
        <ul className="grid gap-2">
          {(q.data?.items ?? []).map((s) => (
            <li key={s.id} className="admin-row">
              <span className="grid">
                <strong>{(locale === 'en' && s.titleEn) || s.titleFr}</strong>
                <span className="text-sm text-ink-muted">
                  {t(k('series_count'), { n: String(s.count) })}
                </span>
              </span>
              <span className="flex gap-2">
                {canEdit && (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>
                    {t('admin.common.edit' as MessageKey)}
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(s)}>
                    {t(k('series_delete'))}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t(k('series_delete_t'))}
        text={t(k('series_delete_p'))}
        confirmLabel={t(k('series_delete'))}
        danger
        busy={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id)}
      />
    </div>
  )
}

function SeriesForm({
  series,
  onDone,
  onCancel,
}: {
  series: Series | null
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useLocale()
  const [v, setV] = useState({
    titleFr: series?.titleFr ?? '',
    titleEn: series?.titleEn ?? '',
    descriptionFr: series?.descriptionFr ?? '',
    descriptionEn: series?.descriptionEn ?? '',
  })
  const save = useMutation({
    mutationFn: () =>
      series
        ? api(`/sermons/series/${series.id}`, { method: 'PATCH', body: v })
        : api('/sermons/series', { method: 'POST', body: v }),
    onSuccess: () => {
      say(t(k('series_saved')))
      onDone()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const f = (key: keyof typeof v, label: string, textarea = false) => (
    <TextField
      label={t(k(label))}
      placeholder=""
      textarea={textarea}
      value={v[key]}
      onChange={(e: { target: { value: string } }) =>
        setV((x) => ({ ...x, [key]: e.target.value }))
      }
    />
  )
  return (
    <div className="admin-panel grid gap-3">
      {f('titleFr', 'series_name_fr')}
      {f('titleEn', 'series_name_en')}
      {f('descriptionFr', 'series_desc_fr', true)}
      {f('descriptionEn', 'series_desc_en', true)}
      <div className="flex gap-2">
        <Button loading={save.isPending} disabled={!v.titleFr.trim()} onClick={() => save.mutate()}>
          {t(k('series_save'))}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('admin.common.cancel' as MessageKey)}
        </Button>
      </div>
    </div>
  )
}

/* ── Editor ───────────────────────────────────────────────────────────── */
function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const saved = useRef<Draft | null>(null)
  const [meta, setMeta] = useState<Item | null>(null)
  const [dialog, setDialog] = useState<
    null | 'publish' | 'versions' | 'delete' | 'archive' | 'unpublish'
  >(null)
  const canPublish = hasPermission(me, 'sermons:publish')
  const canEdit = hasPermission(me, 'sermons:edit')
  const canDelete = hasPermission(me, 'sermons:delete')

  const load = async () => {
    const r = await api<Full>(`/sermons/${id}`)
    const d: Draft = {
      titleFr: r.titleFr,
      titleEn: r.titleEn,
      summaryFr: r.summaryFr,
      summaryEn: r.summaryEn,
      bodyFr: r.bodyFr,
      bodyEn: r.bodyEn,
      transcript: r.transcript,
      preachedOn: r.preachedOn,
      seriesId: r.seriesId,
      preacherName: r.preacherName,
      preacherConsent: r.preacherConsent,
      refs: r.refs,
      youtube: r.youtubeId ? `https://youtu.be/${r.youtubeId}` : '',
      links: r.links,
      coverMediaId: r.coverMediaId,
      sundayDate: r.sundayDate,
      slug: r.slug,
    }
    saved.current = d
    setDraft(d)
    setMeta(r)
    autosave.reset(d)
  }
  const autosave = useAutosave<Draft>(draft, async (v) => {
    const before = saved.current
    // Invalid links or video addresses wait: nothing half-typed is ever sent.
    if (!youtubeOk(v.youtube) || v.links.some((l) => !urlOk(l.url))) return
    const patch: Record<string, unknown> = {}
    for (const key of Object.keys(v) as (keyof Draft)[])
      if (!before || JSON.stringify(v[key]) !== JSON.stringify(before[key])) patch[key] = v[key]
    if (key_count(patch) === 0) return
    const r = await api<{ slug: string }>(`/sermons/${id}`, { method: 'PATCH', body: patch })
    saved.current = { ...v, slug: r.slug }
    setDraft((d) => (d && d.slug !== r.slug ? { ...d, slug: r.slug } : d))
    qc.invalidateQueries({ queryKey: ['sermons'] })
  })
  useEffect(() => {
    load().catch(() => {
      say(t(k('error')), 'danger')
      onBack()
    })
  }, [id])

  const refreshMeta = async () => {
    await autosave.flush()
    await load()
    qc.invalidateQueries({ queryKey: ['sermons'] })
  }
  const act = useMutation({
    mutationFn: async (a: { path: string; body?: unknown; done: string }) => {
      await autosave.flush()
      await api(`/sermons/${id}/${a.path}`, { method: 'POST', body: a.body ?? {} })
      return a.done
    },
    onSuccess: async (done) => {
      setDialog(null)
      say(t(k(done)))
      await load()
      qc.invalidateQueries({ queryKey: ['sermons'] })
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/sermons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('deleted')))
      qc.invalidateQueries({ queryKey: ['sermons'] })
      onBack()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const preview = useMutation({
    mutationFn: async () => {
      await autosave.flush()
      return api<{ token: string }>(`/sermons/${id}/preview`, { method: 'POST', body: {} })
    },
    onSuccess: async ({ token }) => {
      const url = `${location.origin}/${locale}/${locale === 'fr' ? 'actualites/predications/apercu' : 'news/sermons/preview'}/?t=${token}`
      await navigator.clipboard?.writeText(url).catch(() => {})
      say(t(k('preview_copied')))
      window.open(url, '_blank', 'noopener')
    },
  })
  const series = useQuery({
    queryKey: ['sermon-series'],
    queryFn: () => api<{ items: Series[] }>('/sermons/series'),
  })
  const sundays = useQuery({
    queryKey: ['sermon-sundays'],
    enabled: canEdit,
    retry: false,
    queryFn: () =>
      api<{
        items: {
          date: string
          entry: { readings: BibleRef[]; preacherName: string; namesConsent: boolean } | null
        }[]
      }>('/liturgy/sundays'),
  })

  const pastors = useQuery({
    queryKey: ['sermon-preachers'],
    enabled: canEdit,
    retry: false,
    queryFn: () => api<{ names: string[] }>('/sermons/preachers'),
  })
  const [otherPreacher, setOtherPreacher] = useState(false)

  if (!draft || !meta) return <div className="admin-panel" aria-busy="true" />
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  const live = meta.status === 'published'
  const problems = publishProblems({
    title: draft.titleFr,
    bodyEmpty: false,
    publishAt: null,
    unpublishAt: null,
  })
  const fmt = (iso: string) =>
    `${shortDate(iso, locale)} · ${new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(new Date(iso))}`
  const siteUrl = `/${locale}/${locale === 'fr' ? 'actualites/predications' : 'news/sermons'}/${draft.slug}/`
  const today = new Date().toISOString().slice(0, 10)
  const pastorNames = pastors.data?.names ?? []
  // A name of a pastor is picked from the list; anything else (a guest) is typed. The consent was for one person: it resets.
  const preacherPick =
    otherPreacher || (draft.preacherName && !pastorNames.includes(draft.preacherName))
      ? 'other'
      : draft.preacherName || 'none'
  const setPreacher = (name: string) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            preacherName: name,
            preacherConsent: name === d.preacherName ? d.preacherConsent : false,
          }
        : d,
    )
  const linkedSunday = sundays.data?.items.find((x) => x.date === draft.sundayDate)
  const setRef = (i: number, patch: Partial<BibleRef>) =>
    set(
      'refs',
      draft.refs.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    )
  const setLink = (i: number, patch: Partial<Link>) =>
    set(
      'links',
      draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    )
  // Fills what is still empty from the linked Sunday: the date, the passages, the name. The Sunday's consent for a name was for
  // that Sunday only: it is never copied (decision 0031).
  const copyFromSunday = (date: string) => {
    const e = sundays.data?.items.find((x) => x.date === date)?.entry
    setDraft((d) =>
      d
        ? {
            ...d,
            preachedOn: d.preachedOn ?? date,
            refs: d.refs.length === 0 && e?.readings?.length ? e.readings : d.refs,
            preacherName: d.preacherName || (e?.preacherName ?? ''),
          }
        : d,
    )
  }
  const text = (lang: 'Fr' | 'En') => {
    const body = (lang === 'Fr' ? draft.bodyFr : draft.bodyEn) ?? EMPTY_DOC
    return (
      <div className="grid gap-4">
        {lang === 'En' && <p className="text-sm text-ink-muted">{t(k('en_note'))}</p>}
        <TextField
          label={t(k('title_label'))}
          placeholder={t(k('title_ph'))}
          value={lang === 'Fr' ? draft.titleFr : draft.titleEn}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set(`title${lang}`, e.target.value)}
        />
        <TextField
          label={t(k('summary_label'))}
          placeholder={t(k('summary_ph'))}
          value={lang === 'Fr' ? draft.summaryFr : draft.summaryEn}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set(`summary${lang}`, e.target.value)}
        />
        <div className="grid gap-1">
          <span className="field-label">{t(k('body_label'))}</span>
          <Suspense fallback={<div className="rte rte-loading" aria-busy="true" />}>
            <RichTextEditor
              key={lang}
              value={body}
              label={t(k('body_label'))}
              docTitle={lang === 'Fr' ? draft.titleFr : draft.titleEn}
              docFallback={t(k('untitled_full'))}
              placeholder={t(k('body_ph'))}
              onChange={(doc) => set(`body${lang}`, doc)}
            />
          </Suspense>
        </div>
      </div>
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
          <StatusBadge status={meta.status} />
        </div>
      </div>

      <div className="news-editor">
        <div className="grid gap-4">
          <div className="admin-panel">
            <TabsBox
              tabs={[
                { id: 'fr', label: t(k('lang_fr')), content: text('Fr') },
                { id: 'en', label: t(k('lang_en')), content: text('En') },
              ]}
            />
          </div>

          <div className="admin-panel grid gap-4">
            <h2 className="text-lg">{t(k('when'))}</h2>
            <TextField
              label={t(k('preached_on'))}
              type="date"
              placeholder=""
              value={draft.preachedOn ?? ''}
              disabled={!canEdit}
              onChange={(e: { target: { value: string } }) =>
                set('preachedOn', e.target.value || null)
              }
            />
            <SelectField
              label={t(k('preacher'))}
              value={preacherPick}
              onValueChange={(v) => {
                if (!v) return
                if (v === 'none') {
                  setOtherPreacher(false)
                  setPreacher('')
                } else if (v === 'other') {
                  setOtherPreacher(true)
                  if (pastorNames.includes(draft.preacherName)) setPreacher('')
                } else {
                  setOtherPreacher(false)
                  setPreacher(v)
                }
              }}
              options={[
                { value: 'none', label: t(k('preacher_none')) },
                ...pastorNames.map((n) => ({ value: n, label: n })),
                { value: 'other', label: t(k('preacher_other')) },
              ]}
            />
            {preacherPick === 'other' && (
              <TextField
                label={t(k('preacher_other_label'))}
                placeholder=""
                value={draft.preacherName}
                disabled={!canEdit}
                onChange={(e: { target: { value: string } }) => setPreacher(e.target.value)}
              />
            )}
            <SwitchField
              label={t(k('preacher_consent'))}
              hint={t(k('preacher_help'))}
              checked={draft.preacherConsent}
              disabled={!canEdit || !draft.preacherName.trim()}
              onCheckedChange={(v: boolean) => set('preacherConsent', v)}
            />
          </div>

          <div className="admin-panel grid gap-3">
            <h2 className="text-lg">{t(k('sunday_h'))}</h2>
            <p className="text-sm text-ink-muted">{t(k('sunday_help'))}</p>
            {sundays.data && sundays.data.items.length > 0 ? (
              <>
                <SelectField
                  label={t(k('sunday_pick'))}
                  value={draft.sundayDate ?? 'none'}
                  onValueChange={(v) => v && set('sundayDate', v === 'none' ? null : v)}
                  options={[
                    { value: 'none', label: t(k('sunday_none')) },
                    ...sundays.data.items.map((s) => ({
                      value: s.date,
                      label: `${shortDate(`${s.date}T12:00:00Z`, locale)}${s.date > today ? ` · ${t(k('sunday_upcoming'))}` : ''}`,
                    })),
                  ]}
                />
                {linkedSunday && (
                  <div className="sunday-card">
                    <p className="font-medium">
                      {t(k('sunday_linked'), {
                        date: shortDate(`${linkedSunday.date}T12:00:00Z`, locale),
                      })}
                    </p>
                    {linkedSunday.entry ? (
                      <dl className="sunday-facts">
                        <div>
                          <dt>{t(k('passages'))}</dt>
                          <dd>
                            {linkedSunday.entry.readings.length
                              ? linkedSunday.entry.readings
                                  .map((r) => formatRef(r, locale))
                                  .join(' · ')
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>{t(k('preacher'))}</dt>
                          <dd>{linkedSunday.entry.preacherName || '—'}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-ink-muted">{t(k('sunday_empty'))}</p>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyFromSunday(linkedSunday.date)}
                    >
                      {t(k('sunday_copy'))}
                    </Button>
                    <p className="text-xs text-ink-muted">{t(k('sunday_copy_help'))}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t(k('from_sunday_none'))}</p>
            )}
          </div>

          <div className="admin-panel grid gap-3">
            <h2 className="text-lg">{t(k('passages'))}</h2>
            <p className="text-sm text-ink-muted">{t(k('passages_help'))}</p>
            {draft.refs.map((r, i) => {
              const bad =
                r.from != null && r.to != null && r.to !== '' && compareVerses(r.to, r.from) < 0
              return (
                <div
                  key={`${r.book}-${i}`}
                  className="reading-box"
                  data-invalid={bad ? '' : undefined}
                >
                  <div className="reading-row">
                    <div className="reading-book">
                      <SelectField
                        label={t(k('book'))}
                        value={r.book}
                        onValueChange={(v) => v && setRef(i, { book: v as BibleRef['book'] })}
                        options={BOOKS.map((b) => ({
                          value: b.id,
                          label: locale === 'en' ? b.en : b.fr,
                        }))}
                      />
                    </div>
                    <label className="reading-num">
                      <span className="field-label">{t(k('chapter'))}</span>
                      <input
                        className="input"
                        inputMode="numeric"
                        maxLength={3}
                        value={r.chapter}
                        onChange={(e) =>
                          setRef(i, {
                            chapter: Math.min(150, Number(e.target.value.replace(/\D/g, '')) || 1),
                          })
                        }
                      />
                    </label>
                    <label className="reading-num">
                      <span className="field-label">{t(k('from'))}</span>
                      <input
                        className="input"
                        maxLength={4}
                        placeholder="1b"
                        aria-invalid={bad}
                        value={r.from ?? ''}
                        onChange={(e) => setRef(i, { from: verseInput(e.target.value) })}
                      />
                    </label>
                    <label className="reading-num">
                      <span className="field-label">{t(k('to'))}</span>
                      <input
                        className="input"
                        maxLength={4}
                        placeholder="20"
                        aria-invalid={bad}
                        value={r.to ?? ''}
                        onChange={(e) => setRef(i, { to: verseInput(e.target.value) })}
                      />
                    </label>
                    <Button
                      variant="secondary"
                      className="reading-remove"
                      aria-label={t(k('remove'))}
                      onClick={() =>
                        set(
                          'refs',
                          draft.refs.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Icon name="close" size={20} />
                    </Button>
                  </div>
                </div>
              )
            })}
            {draft.refs.length < 8 && canEdit && (
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => set('refs', [...draft.refs, { book: 'mat', chapter: 1 }])}
                >
                  {t(k('add_passage'))}
                </Button>
              </div>
            )}
          </div>

          <div className="admin-panel grid gap-3">
            <h2 className="text-lg">{t(k('video'))}</h2>
            <TextField
              label={t(k('video'))}
              placeholder={t(k('video_ph'))}
              hint={youtubeOk(draft.youtube) ? t(k('video_help')) : t(k('video_bad'))}
              value={draft.youtube}
              disabled={!canEdit}
              aria-invalid={!youtubeOk(draft.youtube)}
              onChange={(e: { target: { value: string } }) => set('youtube', e.target.value)}
            />
          </div>

          <div className="admin-panel grid gap-3">
            <h2 className="text-lg">{t(k('links'))}</h2>
            <p className="text-sm text-ink-muted">{t(k('links_help'))}</p>
            {draft.links.map((l, i) => {
              const kind = l.kind ?? 'other'
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: the list is edited in place
                <div key={i} className="reading-box">
                  <div className="link-row" data-other={kind === 'other' ? '' : undefined}>
                    <SelectField
                      label={t(k('link_kind'))}
                      value={kind}
                      onValueChange={(v) => v && setLink(i, { kind: v as LinkKind })}
                      options={LINK_KINDS.map((x) => ({ value: x, label: t(k(`kind_${x}`)) }))}
                    />
                    {kind === 'other' && (
                      <TextField
                        label={t(k('link_label'))}
                        placeholder={t(k('link_label_ph'))}
                        value={l.label}
                        disabled={!canEdit}
                        onChange={(e: { target: { value: string } }) =>
                          setLink(i, { label: e.target.value })
                        }
                      />
                    )}
                    <TextField
                      label={t(k('link_url'))}
                      placeholder="https://…"
                      hint={l.url && !urlOk(l.url) ? t(k('link_bad')) : undefined}
                      value={l.url}
                      disabled={!canEdit}
                      onChange={(e: { target: { value: string } }) =>
                        setLink(i, { url: e.target.value })
                      }
                    />
                    <Button
                      variant="secondary"
                      className="reading-remove"
                      aria-label={t(k('remove'))}
                      onClick={() =>
                        set(
                          'links',
                          draft.links.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Icon name="close" size={20} />
                    </Button>
                  </div>
                </div>
              )
            })}
            {draft.links.length < 4 && canEdit && (
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    set('links', [...draft.links, { kind: 'audio', label: '', url: '' }])
                  }
                >
                  {t(k('add_link'))}
                </Button>
              </div>
            )}
          </div>

          <div className="admin-panel grid gap-2">
            <span className="field-label">{t(k('transcript_label'))}</span>
            <p className="text-sm text-ink-muted">{t(k('transcript_help'))}</p>
            <Suspense fallback={<div className="rte rte-loading" aria-busy="true" />}>
              <RichTextEditor
                key="transcript"
                value={draft.transcript ?? EMPTY_DOC}
                label={t(k('transcript_label'))}
                docTitle={draft.titleFr}
                docFallback={t(k('untitled_full'))}
                placeholder=""
                onChange={(doc) => set('transcript', doc)}
              />
            </Suspense>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="admin-panel">
            <h2 className="text-lg">{t(k('side_status'))}</h2>
            <p className="text-sm text-ink-muted">
              {meta.status === 'scheduled' && meta.publishAt
                ? t(k('scheduled_for'), { date: fmt(meta.publishAt) })
                : live
                  ? `${t(k('live_since'))}${meta.unpublishAt ? ` ${t(k('until'), { date: fmt(meta.unpublishAt) })}` : ''}`
                  : t(`content.status.${meta.status}`)}
            </p>
            <div className="flex flex-wrap gap-2">
              {canPublish && meta.status !== 'archived' && (
                <Button onClick={() => setDialog('publish')}>
                  {t(k(live || meta.status === 'scheduled' ? 'change_dates' : 'publish'))}
                </Button>
              )}
              {canPublish && (live || meta.status === 'scheduled') && (
                <Button variant="secondary" onClick={() => setDialog('unpublish')}>
                  {t(k('unpublish'))}
                </Button>
              )}
              {canPublish && meta.status === 'archived' && (
                <Button
                  variant="secondary"
                  onClick={() => act.mutate({ path: 'unpublish', done: 'unpublished' })}
                >
                  {t(k('unpublish'))}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={preview.isPending}
                onClick={() => preview.mutate()}
              >
                {t(k('preview'))}
                <Icon name="external" size={16} />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDialog('versions')}>
                {t(k('versions'))}
              </Button>
              {live && (
                <a className="btn btn-ghost btn-sm" href={siteUrl} target="_blank" rel="noreferrer">
                  {t(k('view_site'))}
                  <Icon name="external" size={16} />
                </a>
              )}
            </div>
            <p className="text-xs text-ink-muted">{t(k('preview_help'))}</p>
          </div>

          <div className="admin-panel">
            <CoverField mediaId={draft.coverMediaId} onChange={(v) => set('coverMediaId', v)} />
            {series.data && (
              <SelectField
                label={t(k('series'))}
                value={draft.seriesId ?? 'none'}
                onValueChange={(v) => set('seriesId', !v || v === 'none' ? null : v)}
                options={[
                  { value: 'none', label: t(k('series_none')) },
                  ...series.data.items.map((s) => ({
                    value: s.id,
                    label: (locale === 'en' && s.titleEn) || s.titleFr,
                  })),
                ]}
              />
            )}
            <div className="grid gap-1">
              <span className="field-label">{t(k('side_slug'))}</span>
              <code className="admin-link-box">{siteUrl}</code>
              <p className="text-xs text-ink-muted">{t(k('side_slug_help'))}</p>
            </div>
          </div>

          <div className="admin-panel">
            {canPublish && meta.status !== 'archived' && (
              <Button variant="secondary" onClick={() => setDialog('archive')}>
                {t(k('archive'))}
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setDialog('delete')}>
                {t(k('delete'))}
              </Button>
            )}
          </div>
        </aside>
      </div>

      <PublishDialog
        key={`${meta.publishAt}-${meta.unpublishAt}-${dialog}`}
        open={dialog === 'publish'}
        onClose={() => setDialog(null)}
        live={live || meta.status === 'scheduled'}
        busy={act.isPending}
        problems={problems}
        initial={{
          publishAt: meta.status === 'scheduled' ? meta.publishAt : null,
          unpublishAt: meta.unpublishAt,
        }}
        onConfirm={(c) =>
          act.mutate({
            path: 'publish',
            body: c,
            done: c.publishAt && new Date(c.publishAt) > new Date() ? 'scheduled' : 'published',
          })
        }
      />
      <RevisionsDrawer
        open={dialog === 'versions'}
        onClose={() => setDialog(null)}
        base={`/sermons/${id}`}
        onRestored={() => {
          say(t(k('restored')))
          refreshMeta()
        }}
      />
      <ConfirmDialog
        open={dialog === 'unpublish'}
        onClose={() => setDialog(null)}
        title={t(k('unpublish_t'))}
        text={t(k('unpublish_p'))}
        confirmLabel={t(k('unpublish'))}
        busy={act.isPending}
        onConfirm={() => act.mutate({ path: 'unpublish', done: 'unpublished' })}
      />
      <ConfirmDialog
        open={dialog === 'archive'}
        onClose={() => setDialog(null)}
        title={t(k('archive_t'))}
        text={t(k('archive_p'))}
        confirmLabel={t(k('archive'))}
        busy={act.isPending}
        onConfirm={() => act.mutate({ path: 'archive', done: 'archived' })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={t(k('delete_t'))}
        text={t(k('delete_p'))}
        confirmLabel={t(k('delete'))}
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
