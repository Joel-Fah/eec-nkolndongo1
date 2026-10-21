/**
 * News (admin, /m/news): the list with filters, and the editor — title, summary, text in French and English,
 * photo, group, address — with autosave, a plain « Publier » dialog, earlier versions and preview links.
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
} from '@eec/content-kit'
import { type Doc, EMPTY_DOC, isEmptyDoc, publishProblems, type Status, shortDate } from '@eec/core'
import type { MessageKey } from '@eec/i18n'
import {
  Badge,
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
  groupId: string | null
  groupName: string | null
  publishAt: string | null
  unpublishAt: string | null
  pinned: boolean
  titleFr: string
  titleEn: string
  updatedAt: string
}
type Full = Item & {
  excerptFr: string
  excerptEn: string
  coverMediaId: string | null
  bodyFr: Doc
  bodyEn: Doc
}
type Draft = Pick<
  Full,
  | 'titleFr'
  | 'titleEn'
  | 'excerptFr'
  | 'excerptEn'
  | 'bodyFr'
  | 'bodyEn'
  | 'coverMediaId'
  | 'groupId'
  | 'pinned'
  | 'slug'
>

const k = (key: string) => `news.${key}` as MessageKey
const say = (title: string, tone: 'success' | 'danger' = 'success') =>
  toastManager.add({ title, data: { tone } })

export default function NewsPage() {
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

/* ── List ─────────────────────────────────────────────────────────────── */
function List({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  const list = useQuery({
    queryKey: ['news', params.toString()],
    queryFn: () => api<{ items: Item[]; counts: Record<Status, number> }>(`/news?${params}`),
  })
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/news', { method: 'POST', body: {} }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['news'] })
      onOpen(r.id)
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const fmt = (iso: string) => shortDate(iso, locale)
  const counts = list.data?.counts

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-[62ch] gap-2">
          <h1 className="text-4xl">{t(k('title'))}</h1>
          <p className="text-ink-muted">{t(k('lead'))}</p>
        </div>
        {hasPermission(me, 'news:edit') && (
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            {t(k('write'))}
          </Button>
        )}
      </header>

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
      </div>

      {list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={t(k(q || status ? 'empty_filter_t' : 'empty_t'))}
          text={t(k(q || status ? 'empty_filter_p' : 'empty_p'))}
        >
          {!q && !status && hasPermission(me, 'news:edit') && (
            <Button onClick={() => create.mutate()}>{t(k('write'))}</Button>
          )}
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {(list.data?.items ?? []).map((n) => (
            <li key={n.id}>
              <button type="button" className="admin-row news-row" onClick={() => onOpen(n.id)}>
                <span className="grid text-start">
                  <strong>{n.titleFr || t(k('untitled'))}</strong>
                  <span className="text-sm text-ink-muted">
                    {t(k('updated'), { date: fmt(n.updatedAt) })}
                    {n.groupName ? ` · ${n.groupName}` : ''}
                    {n.status === 'scheduled' && n.publishAt
                      ? ` · ${t(k('scheduled_for'), { date: fmt(n.publishAt) })}`
                      : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {n.pinned && <Badge tone="gold">{t(k('pinned'))}</Badge>}
                  <StatusBadge status={n.status} />
                </span>
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
  const [draft, setDraft] = useState<Draft | null>(null)
  const saved = useRef<Draft | null>(null)
  const [meta, setMeta] = useState<Item | null>(null)
  const [dialog, setDialog] = useState<
    null | 'publish' | 'versions' | 'delete' | 'archive' | 'unpublish'
  >(null)
  const canPublish = hasPermission(me, 'news:publish')
  const canEdit = hasPermission(me, 'news:edit')
  const canDelete = hasPermission(me, 'news:delete')

  const load = async () => {
    const r = await api<Full>(`/news/${id}`)
    const d: Draft = {
      titleFr: r.titleFr,
      titleEn: r.titleEn,
      excerptFr: r.excerptFr,
      excerptEn: r.excerptEn,
      bodyFr: r.bodyFr,
      bodyEn: r.bodyEn,
      coverMediaId: r.coverMediaId,
      groupId: r.groupId,
      pinned: r.pinned,
      slug: r.slug,
    }
    saved.current = d
    setDraft(d)
    setMeta(r)
    autosave.reset(d)
  }
  const autosave = useAutosave<Draft>(draft, async (v) => {
    const before = saved.current
    const patch: Record<string, unknown> = {}
    for (const key of Object.keys(v) as (keyof Draft)[])
      if (!before || JSON.stringify(v[key]) !== JSON.stringify(before[key])) patch[key] = v[key]
    if (key_count(patch) === 0) return
    const r = await api<{ slug: string }>(`/news/${id}`, { method: 'PATCH', body: patch })
    saved.current = { ...v, slug: r.slug }
    setDraft((d) => (d && d.slug !== r.slug ? { ...d, slug: r.slug } : d))
    qc.invalidateQueries({ queryKey: ['news'] })
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
    qc.invalidateQueries({ queryKey: ['news'] })
  }
  const act = useMutation({
    mutationFn: async (a: { path: string; body?: unknown; done: string }) => {
      await autosave.flush()
      await api(`/news/${id}/${a.path}`, { method: 'POST', body: a.body ?? {} })
      return a.done
    },
    onSuccess: async (done) => {
      setDialog(null)
      say(t(k(done)))
      await load()
      qc.invalidateQueries({ queryKey: ['news'] })
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const remove = useMutation({
    mutationFn: () => api(`/news/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      say(t(k('deleted')))
      qc.invalidateQueries({ queryKey: ['news'] })
      onBack()
    },
    onError: () => say(t(k('error')), 'danger'),
  })
  const preview = useMutation({
    mutationFn: async () => {
      await autosave.flush()
      return api<{ token: string }>(`/news/${id}/preview`, { method: 'POST', body: {} })
    },
    onSuccess: async ({ token }) => {
      const url = `${location.origin}/${locale}/${locale === 'fr' ? 'actualites/nouvelles/apercu' : 'news/latest/preview'}/?t=${token}`
      await navigator.clipboard?.writeText(url).catch(() => {})
      say(t(k('preview_copied')))
      window.open(url, '_blank', 'noopener')
    },
  })
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () =>
      api<{ groups: { id: string; nameFr: string; nameEn: string | null }[] }>('/groups'),
    retry: false,
  })

  if (!draft || !meta) return <div className="admin-panel" aria-busy="true" />
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  const live = meta.status === 'published'
  const problems = publishProblems({
    title: draft.titleFr,
    bodyEmpty: isEmptyDoc(draft.bodyFr),
    publishAt: null,
    unpublishAt: null,
  })
  const fmt = (iso: string) =>
    `${shortDate(iso, locale)} · ${new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(new Date(iso))}`
  const siteUrl = `/${locale}/${locale === 'fr' ? 'actualites/nouvelles' : 'news/latest'}/${draft.slug}/`
  const editor = (lang: 'Fr' | 'En') => {
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
          label={t(k('excerpt_label'))}
          placeholder={t(k('excerpt_ph'))}
          value={lang === 'Fr' ? draft.excerptFr : draft.excerptEn}
          disabled={!canEdit}
          onChange={(e: { target: { value: string } }) => set(`excerpt${lang}`, e.target.value)}
        />
        <div className="grid gap-1">
          <span className="field-label">{t(k('body_label'))}</span>
          <Suspense fallback={<div className="rte rte-loading" aria-busy="true" />}>
            <RichTextEditor
              key={lang}
              value={body}
              label={t(k('body_label'))}
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
        <div className="admin-panel">
          <TabsBox
            tabs={[
              { id: 'fr', label: t(k('lang_fr')), content: editor('Fr') },
              { id: 'en', label: t(k('lang_en')), content: editor('En') },
            ]}
          />
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
            {groups.data && (
              <SelectField
                label={t(k('side_group'))}
                value={draft.groupId ?? 'none'}
                onValueChange={(v) => set('groupId', !v || v === 'none' ? null : v)}
                options={[
                  { value: 'none', label: t(k('group_all')) },
                  ...groups.data.groups.map((g) => ({
                    value: g.id,
                    label: locale === 'en' && g.nameEn ? g.nameEn : g.nameFr,
                  })),
                ]}
              />
            )}
            <TextField
              label={t(k('side_slug'))}
              placeholder={t(k('side_slug_ph'))}
              hint={t(k('side_slug_help'))}
              value={draft.slug}
              disabled={!canEdit}
              onChange={(e: { target: { value: string } }) => set('slug', e.target.value)}
            />
            <SwitchField
              label={t(k('side_pin'))}
              checked={draft.pinned}
              onCheckedChange={(v: boolean) => set('pinned', v)}
            />
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
        base={`/news/${id}`}
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

const key_count = (o: object) => Object.keys(o).length
