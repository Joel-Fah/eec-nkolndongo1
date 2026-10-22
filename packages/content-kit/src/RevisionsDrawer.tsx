/** « Versions précédentes »: what was there and when, with a one-click restore (which keeps the current text as a version too). */
import { Dialog } from '@base-ui/react/dialog'
import { api, useLocale } from '@eec/admin-kit'
import { Button, EmptyState } from '@eec/ui/react'
import { useMutation, useQuery } from '@tanstack/react-query'

type Revision = { id: string; reason: string; createdAt: string; title: string; words: number }

export function RevisionsDrawer({
  open,
  onClose,
  base,
  onRestored,
}: {
  open: boolean
  onClose: () => void
  /** e.g. `/news/<id>` — the module's API exposes `/revisions` and `/revisions/:rid/restore` under it. */
  base: string
  onRestored: () => void
}) {
  const { t, locale } = useLocale()
  const list = useQuery({
    queryKey: ['revisions', base],
    enabled: open,
    queryFn: () => api<{ items: Revision[] }>(`${base}/revisions`),
  })
  const restore = useMutation({
    mutationFn: (rid: string) =>
      api(`${base}/revisions/${rid}/restore`, { method: 'POST', body: {} }),
    onSuccess: () => {
      onRestored()
      onClose()
    },
  })
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="sheet eec-sheet" data-side="end">
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{t('content.revisions.title')}</Dialog.Title>
            <p className="text-sm text-ink-muted">{t('content.revisions.lead')}</p>
            {list.data?.items.length === 0 && <EmptyState title={t('content.revisions.empty')} />}
            <ul className="revisions">
              {(list.data?.items ?? []).map((r) => (
                <li key={r.id} className="admin-row">
                  <span className="grid">
                    <strong>{when(r.createdAt)}</strong>
                    <span className="text-sm text-ink-muted">
                      {t(
                        `content.revisions.reason_${r.reason}` as 'content.revisions.reason_autosave',
                      )}{' '}
                      · {t('content.revisions.words', { n: String(r.words) })}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={restore.isPending}
                    onClick={() => restore.mutate(r.id)}
                  >
                    {t('content.revisions.restore')}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={onClose}>
                {t('content.revisions.close')}
              </Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
