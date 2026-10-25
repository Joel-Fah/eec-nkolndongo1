/**
 * « Publier » in plain words: now, or on a chosen day and hour, with an optional end date. Says what is missing
 * before it lets go (title, text, dates that do not make sense).
 */
import { Dialog } from '@base-ui/react/dialog'
import { DateTimeField, useLocale } from '@eec/admin-kit'
import { Button } from '@eec/ui/react'
import { useState } from 'react'

export type PublishChoice = { publishAt: string | null; unpublishAt: string | null }

/** `2026-11-02T08:00` (local) ← ISO. */
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : null)

export function PublishDialog({
  open,
  onClose,
  onConfirm,
  initial,
  problems,
  busy,
  live,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (c: PublishChoice) => void
  initial: PublishChoice
  problems: ('title' | 'body' | 'dates')[]
  busy: boolean
  /** Already visible on the site: the dialog then only changes the dates. */
  live: boolean
}) {
  const { t } = useLocale()
  const [mode, setMode] = useState<'now' | 'later'>(initial.publishAt ? 'later' : 'now')
  const [from, setFrom] = useState(toLocal(initial.publishAt))
  const [until, setUntil] = useState(toLocal(initial.unpublishAt))
  const missing = [...problems]
  if (mode === 'later' && !from) missing.push('dates')
  const blocked = missing.length > 0
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="dialog eec-dialog">
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">
              {t(live ? 'content.publish.title_change' : 'content.publish.title')}
            </Dialog.Title>
            {blocked && (
              <ul className="publish-problems" role="alert">
                {[...new Set(missing)].map((p) => (
                  <li key={p}>{t(`content.publish.problem_${p}`)}</li>
                ))}
              </ul>
            )}
            <fieldset className="publish-modes">
              <legend className="field-label">{t('content.publish.when')}</legend>
              <label className="publish-mode">
                <input
                  type="radio"
                  name="when"
                  checked={mode === 'now'}
                  onChange={() => setMode('now')}
                />
                <span>{t('content.publish.now')}</span>
              </label>
              <label className="publish-mode">
                <input
                  type="radio"
                  name="when"
                  checked={mode === 'later'}
                  onChange={() => setMode('later')}
                />
                <span>{t('content.publish.later')}</span>
              </label>
            </fieldset>
            {mode === 'later' && (
              <DateTimeField
                label={t('content.publish.from')}
                value={from}
                onChange={(v: string) => setFrom(v)}
              />
            )}
            <DateTimeField
              label={t('content.publish.until')}
              value={until}
              onChange={(v: string) => setUntil(v)}
              hint={t('content.publish.until_help')}
            />
            <div className="dialog-actions">
              <Button variant="secondary" onClick={onClose}>
                {t('content.picker.cancel')}
              </Button>
              <Button
                loading={busy}
                disabled={blocked}
                onClick={() =>
                  onConfirm({
                    publishAt: mode === 'later' ? toIso(from) : null,
                    unpublishAt: toIso(until),
                  })
                }
              >
                {t(
                  mode === 'later'
                    ? 'content.publish.confirm_later'
                    : 'content.publish.confirm_now',
                )}
              </Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
