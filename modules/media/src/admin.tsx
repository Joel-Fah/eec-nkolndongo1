/**
 * Media library (admin, /m/media): upload with per-photo descriptions (required), the library as a grid,
 * and a detail panel (descriptions, credit, usages, copy link, archive, delete). Photos are prepared in the
 * browser (process.worker.ts); audio and PDF are sent as they are.
 */
import { Dialog } from '@base-ui/react/dialog'
import { ApiError, api, hasPermission, useLocale, useMe } from '@eec/admin-kit'
import type { MessageKey } from '@eec/i18n'
import { Badge, Button, SelectField, TextField, toastManager } from '@eec/ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { thumbHashToDataURL } from 'thumbhash'
import { processImage } from './process.ts'
import { LIMITS, type MediaKind } from './rules.ts'
import type { MediaVariant } from './schema.ts'

type Item = {
  id: string
  kind: MediaKind
  mime: string
  originalName: string
  sizeBytes: number
  width: number | null
  height: number | null
  variants: MediaVariant[]
  placeholder: string | null
  altFr: string | null
  altEn: string | null
  captionFr: string | null
  captionEn: string | null
  credit: string | null
  creditUrl: string | null
  source: string
  status: string
}
type Detail = Item & { usages: { entityType: string; entityId: string; field: string }[] }
type Stats = { usedBytes: number; quotaBytes: number }

const k = (key: string) => `media.${key}` as MessageKey
const mb = (n: number) =>
  n >= 1024 ** 3
    ? `${(n / 1024 ** 3).toFixed(1)} Go`
    : n >= 1024 ** 2
      ? `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0)} Mo`
      : `${Math.max(1, Math.round(n / 1024))} Ko`
const kindOf = (f: File): MediaKind | null =>
  f.type.startsWith('image/')
    ? 'image'
    : f.type.startsWith('audio/')
      ? 'audio'
      : f.type === 'application/pdf'
        ? 'document'
        : null
const mediaUrl = (v: MediaVariant | undefined) => (v ? `/media/${v.key}` : '')
const hashUrl = (p: string | null) => {
  if (!p) return undefined
  try {
    return thumbHashToDataURL(Uint8Array.from(atob(p), (c) => c.charCodeAt(0)))
  } catch {
    return undefined
  }
}

export default function MediaPage() {
  const { t } = useLocale()
  const me = useMe().data
  const qc = useQueryClient()
  const canUpload = hasPermission(me, 'media:upload')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'' | 'unused' | 'archived'>('')
  const [open, setOpen] = useState<string | null>(null)
  const params = new URLSearchParams()
  if (kind) params.set('kind', kind)
  if (q) params.set('q', q)
  if (view === 'unused') params.set('unused', '1')
  if (view === 'archived') params.set('status', 'archived')
  const list = useQuery({
    queryKey: ['media', params.toString()],
    queryFn: () => api<{ items: Item[] }>(`/media?${params}`),
  })
  const stats = useQuery({ queryKey: ['media-stats'], queryFn: () => api<Stats>('/media/stats') })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['media'] })
    qc.invalidateQueries({ queryKey: ['media-stats'] })
  }
  const pct = stats.data ? stats.data.usedBytes / stats.data.quotaBytes : 0

  return (
    <div className="grid gap-6">
      <header className="grid max-w-[62ch] gap-2">
        <h1 className="text-4xl">{t(k('title'))}</h1>
        <p className="text-ink-muted">{t(k('lead'))}</p>
      </header>

      {stats.data && (
        <div className="grid max-w-md gap-1">
          <p className="text-sm text-ink-muted">
            {t(k('storage'), { used: mb(stats.data.usedBytes), quota: mb(stats.data.quotaBytes) })}
          </p>
          <progress
            className="media-meter"
            value={Math.min(1, pct)}
            max={1}
            data-warn={pct >= 0.7 ? '' : undefined}
          />
          {pct >= 0.7 && <p className="text-sm text-warning">{t(k('storage_warn'))}</p>}
        </div>
      )}

      {canUpload && <Uploader onDone={refresh} />}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <TextField
            label={t(k('search'))}
            placeholder={t(k('search'))}
            value={q}
            onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
          />
        </div>
        <SelectField
          label={t(k('filter.all'))}
          value={kind}
          onValueChange={(v: string | null) => setKind(!v || v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: t(k('filter.all')) },
            { value: 'image', label: t(k('filter.image')) },
            { value: 'audio', label: t(k('filter.audio')) },
            { value: 'document', label: t(k('filter.document')) },
          ]}
        />
        <div className="flex gap-2">
          {(['unused', 'archived'] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? 'primary' : 'secondary'}
              onClick={() => setView(view === v ? '' : v)}
              aria-pressed={view === v}
            >
              {t(k(`filter.${v}`))}
            </Button>
          ))}
        </div>
      </div>

      {list.isPending ? (
        <div className="media-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="skeleton aspect-square" />
          ))}
        </div>
      ) : list.data?.items.length ? (
        <ul className="media-grid">
          {list.data.items.map((m) => (
            <li key={m.id}>
              <button type="button" className="media-card" onClick={() => setOpen(m.id)}>
                <span
                  className="media-thumb"
                  style={{ backgroundImage: `url(${hashUrl(m.placeholder) ?? ''})` }}
                >
                  {m.kind === 'image' ? (
                    <img
                      src={mediaUrl(m.variants[0])}
                      alt={m.altFr ?? ''}
                      loading="lazy"
                      width={m.variants[0]?.width}
                    />
                  ) : (
                    <span className="media-kind">{m.kind === 'audio' ? '♪' : 'PDF'}</span>
                  )}
                </span>
                <span className="media-name">{m.originalName}</span>
                <span className="media-meta">
                  {mb(m.sizeBytes)}{' '}
                  {m.status === 'archived' && (
                    <Badge tone="warning">{t(k('filter.archived'))}</Badge>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid justify-items-center gap-2 rounded-lg bg-surface-2 p-10 text-center">
          <p className="text-xl font-medium">{t(k('empty_title'))}</p>
          <p className="max-w-[48ch] text-ink-muted">{t(k('empty_text'))}</p>
        </div>
      )}

      {open && <DetailPanel id={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  )
}

/* ── Upload ──────────────────────────────────────────────────────────────────────────────────── */
type QueueItem = {
  id: string
  file: File
  kind: MediaKind
  state: 'processing' | 'ready' | 'sending' | 'done' | 'error'
  error?: string
  altFr: string
  preview?: string
  processed?: Extract<Awaited<ReturnType<typeof processImage>>, { ok: true }>
}

function Uploader({ onDone }: { onDone: () => void }) {
  const { t } = useLocale()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const patch = (id: string, p: Partial<QueueItem>) =>
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const add = (files: FileList | File[]) => {
    for (const file of files) {
      const kind = kindOf(file)
      const id = crypto.randomUUID()
      const limit =
        kind === 'image' ? LIMITS.imageOriginal : kind === 'audio' ? LIMITS.audio : LIMITS.document
      if (!kind || file.size > limit) {
        setQueue((q) => [
          ...q,
          {
            id,
            file,
            kind: kind ?? 'document',
            state: 'error',
            error: kind ? 'too_large' : 'bad_type',
            altFr: '',
          },
        ])
        continue
      }
      setQueue((q) => [
        ...q,
        {
          id,
          file,
          kind,
          state: kind === 'image' ? 'processing' : 'ready',
          altFr: '',
          preview: kind === 'image' ? URL.createObjectURL(file) : undefined,
        },
      ])
      if (kind === 'image')
        processImage(file).then((out) =>
          out.ok
            ? patch(id, { state: 'ready', processed: out })
            : patch(id, { state: 'error', error: 'unreadable' }),
        )
    }
  }

  const send = async (item: QueueItem) => {
    patch(item.id, { state: 'sending', error: undefined })
    try {
      let res: Response
      if (item.kind === 'image' && item.processed) {
        const form = new FormData()
        form.set(
          'meta',
          JSON.stringify({
            originalName: item.file.name,
            width: item.processed.width,
            height: item.processed.height,
            placeholder: item.processed.placeholder,
            altFr: item.altFr.trim(),
          }),
        )
        for (const v of item.processed.variants) form.set(`w${v.width}`, v.blob, `w${v.width}`)
        res = await fetch('/api/media/image', {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
        })
      } else {
        res = await fetch(`/api/media/file?name=${encodeURIComponent(item.file.name)}`, {
          method: 'POST',
          body: item.file,
          credentials: 'same-origin',
          headers: { 'content-type': item.file.type || 'application/octet-stream' },
        })
      }
      if (!res.ok) {
        const code =
          ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error
            ?.code ?? 'generic'
        throw new ApiError(res.status, code)
      }
      patch(item.id, { state: 'done' })
      onDone()
    } catch (e) {
      patch(item.id, { state: 'error', error: e instanceof ApiError ? e.code : 'generic' })
    }
  }

  const sendable = queue.filter(
    (x) => x.state === 'ready' && (x.kind !== 'image' || x.altFr.trim()),
  )
  useEffect(
    () => () => {
      for (const x of queue) if (x.preview) URL.revokeObjectURL(x.preview)
    },
    [queue],
  )

  return (
    <section className="grid gap-4" aria-label={t(k('upload'))}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag and drop is a convenience; the button below does the same */}
      <div
        className="media-drop"
        data-over={over ? '' : undefined}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          add(e.dataTransfer.files)
        }}
      >
        <p className="text-lg font-medium">{t(k('drop'))}</p>
        <p className="max-w-[60ch] text-sm text-ink-muted">{t(k('drop_help'))}</p>
        <Button onClick={() => input.current?.click()}>{t(k('upload'))}</Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/*,audio/*,application/pdf"
          onChange={(e) => e.target.files && add(e.target.files)}
        />
      </div>

      {queue.length > 0 && (
        <div className="grid gap-3 rounded-lg bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl">{t(k('queue.title'))}</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setQueue([])}>
                {t(k('queue.clear'))}
              </Button>
              <Button disabled={!sendable.length} onClick={() => sendable.forEach(send)}>
                {t(k('queue.send_all'))}
              </Button>
            </div>
          </div>
          <ul className="grid gap-3">
            {queue.map((x) => (
              <li key={x.id} className="media-queue-row">
                <span className="media-queue-thumb">
                  {x.preview ? (
                    <img src={x.preview} alt="" />
                  ) : (
                    <span className="media-kind">{x.kind === 'audio' ? '♪' : 'PDF'}</span>
                  )}
                </span>
                <div className="grid min-w-0 gap-2">
                  <p className="truncate font-medium">
                    {x.file.name}{' '}
                    <span className="text-sm text-ink-muted">· {mb(x.file.size)}</span>
                  </p>
                  {x.kind === 'image' && x.state !== 'done' && (
                    <TextField
                      label={t(k('queue.alt'))}
                      hint={t(k('queue.alt_help'))}
                      placeholder="Des fidèles chantent devant le temple"
                      value={x.altFr}
                      onChange={(e: { target: { value: string } }) =>
                        patch(x.id, { altFr: e.target.value })
                      }
                    />
                  )}
                  <p className="text-sm" role="status">
                    {x.state === 'error' ? (
                      <span className="text-danger">{t(k(`err.${x.error ?? 'generic'}`))}</span>
                    ) : (
                      <Badge tone={x.state === 'done' ? 'success' : 'info'}>
                        {t(k(`queue.${x.state}`))}
                      </Badge>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {x.state === 'error' && x.processed && (
                    <Button variant="secondary" onClick={() => send(x)}>
                      ↻
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => setQueue((q) => q.filter((y) => y.id !== x.id))}
                  >
                    {t(k('queue.remove'))}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/* ── Detail ──────────────────────────────────────────────────────────────────────────────────── */
function DetailPanel({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const canEdit = hasPermission(me, 'media:edit')
  const canDelete = hasPermission(me, 'media:delete')
  const data = useQuery({
    queryKey: ['media', 'detail', id],
    queryFn: () => api<Detail>(`/media/${id}`),
  })
  const [form, setForm] = useState<Record<string, string>>({})
  useEffect(() => {
    const d = data.data
    if (d)
      setForm({
        altFr: d.altFr ?? '',
        altEn: d.altEn ?? '',
        captionFr: d.captionFr ?? '',
        captionEn: d.captionEn ?? '',
        credit: d.credit ?? '',
        creditUrl: d.creditUrl ?? '',
      })
  }, [data.data])
  const done = (key: string) => {
    toastManager.add({ title: t(k(key)), data: { tone: 'success' } })
    onChanged()
  }
  const fail = (e: unknown) =>
    toastManager.add({
      title: t(k(`err.${(e as { code?: string }).code ?? 'generic'}`)),
      data: { tone: 'danger' },
    })
  const save = useMutation({
    mutationFn: () => api(`/media/${id}`, { method: 'PATCH', body: form }),
    onSuccess: () => done('detail.saved'),
    onError: fail,
  })
  const status = useMutation({
    mutationFn: (to: 'archive' | 'restore') =>
      api(`/media/${id}/${to}`, { method: 'POST', body: {} }),
    onSuccess: (_r, to) => {
      done(to === 'archive' ? 'detail.archived' : 'detail.restored')
      onClose()
    },
    onError: fail,
  })
  const del = useMutation({
    mutationFn: () => api(`/media/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      done('detail.deleted')
      onClose()
    },
    onError: fail,
  })
  const d = data.data
  const set = (key: string) => ({
    value: form[key] ?? '',
    onChange: (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
    disabled: !canEdit,
  })
  const largest = d?.variants.at(-1)
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="sheet eec-sheet" data-side="end" data-wide="">
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{t(k('detail.title'))}</Dialog.Title>
            {!d ? (
              <span className="skeleton h-64" aria-busy="true" />
            ) : (
              <div className="grid gap-4">
                {d.kind === 'image' && largest && (
                  <img className="media-preview" src={mediaUrl(largest)} alt={d.altFr ?? ''} />
                )}
                {d.kind === 'audio' && (
                  // biome-ignore lint/a11y/useMediaCaption: recordings of services have no caption track yet
                  <audio controls preload="none" src={mediaUrl(d.variants[0])} className="w-full" />
                )}
                {d.kind === 'document' && (
                  <a
                    className="btn btn-secondary"
                    href={mediaUrl(d.variants[0])}
                    target="_blank"
                    rel="noopener"
                  >
                    PDF ↗
                  </a>
                )}
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-ink-muted">{t(k('detail.name'))}</dt>
                  <dd className="truncate">{d.originalName}</dd>
                  <dt className="text-ink-muted">{t(k('detail.size'))}</dt>
                  <dd>{mb(d.sizeBytes)}</dd>
                  {d.width && (
                    <>
                      <dt className="text-ink-muted">{t(k('detail.dimensions'))}</dt>
                      <dd>
                        {d.width} × {d.height}
                      </dd>
                    </>
                  )}
                  <dt className="text-ink-muted">{t(k('detail.source'))}</dt>
                  <dd>{t(k(`detail.source_${d.source}`))}</dd>
                </dl>
                {d.kind === 'image' && (
                  <TextField
                    label={t(k('detail.alt_fr'))}
                    placeholder="Des fidèles chantent devant le temple"
                    {...set('altFr')}
                    required
                  />
                )}
                {d.kind === 'image' && (
                  <TextField
                    label={t(k('detail.alt_en'))}
                    placeholder="Worshippers singing in front of the church"
                    {...set('altEn')}
                  />
                )}
                <TextField
                  label={t(k('detail.caption_fr'))}
                  placeholder="Culte du dimanche, octobre 2026"
                  {...set('captionFr')}
                />
                <TextField
                  label={t(k('detail.caption_en'))}
                  placeholder="Sunday service, October 2026"
                  {...set('captionEn')}
                />
                <TextField
                  label={t(k('detail.credit'))}
                  placeholder="Marie Nkoa"
                  {...set('credit')}
                />
                <TextField
                  label={t(k('detail.credit_url'))}
                  placeholder="https://www.pexels.com/@marie"
                  {...set('creditUrl')}
                />
                <div>
                  <h3 className="text-lg">{t(k('detail.usages'))}</h3>
                  {d.usages.length ? (
                    <ul className="text-sm">
                      {d.usages.map((u) => (
                        <li key={`${u.entityType}${u.entityId}${u.field}`}>
                          {u.entityType} · {u.field}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">{t(k('detail.no_usages'))}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `${location.origin}${mediaUrl(largest ?? d.variants[0])}`,
                      )
                      toastManager.add({ title: t(k('detail.copied')), data: { tone: 'success' } })
                    }}
                  >
                    {t(k('detail.copy'))}
                  </Button>
                  {canEdit && (
                    <Button loading={save.isPending} onClick={() => save.mutate()}>
                      {t(k('detail.save'))}
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="secondary"
                      onClick={() => status.mutate(d.status === 'archived' ? 'restore' : 'archive')}
                    >
                      {t(k(d.status === 'archived' ? 'detail.restore' : 'detail.archive'))}
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(t(k('detail.delete_confirm'), { name: d.originalName })))
                          del.mutate()
                      }}
                    >
                      {t(k('detail.delete'))}
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="dialog-actions">
              <Dialog.Close className="btn btn-secondary">
                {locale === 'fr' ? 'Fermer' : 'Close'}
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
