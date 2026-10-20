/**
 * Small building blocks shared by the admin screens: page header, access gate, confirmations (type the
 * word for dangerous ones), copyable links, toasts with undo, dates. Plain French, tokens only.
 */
import { Dialog } from '@base-ui/react/dialog'
import { hasPermission, useLocale, useMe } from '@eec/admin-kit'
import { formatDate } from '@eec/i18n'
import { Button, EmptyState, toastManager } from '@eec/ui/react'
import { type ReactNode, useId, useState } from 'react'
import { Illustration } from './Illustration'

export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string
  lead?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid max-w-[62ch] gap-2">
        <h1 className="text-4xl">{title}</h1>
        {lead && <p className="text-ink-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

/** Hides a whole screen from people without the right (the API refuses anyway). */
export function Gate({ permission, children }: { permission: string; children: ReactNode }) {
  const { t } = useLocale()
  const me = useMe()
  if (me.isPending) return null
  if (!hasPermission(me.data, permission))
    return (
      <EmptyState
        title={t('admin.common.no_access_title')}
        text={t('admin.common.no_access_text')}
        art={<Illustration />}
      />
    )
  return <>{children}</>
}

export function notify(
  title: string,
  opts: { tone?: 'success' | 'danger' | 'neutral'; undo?: { label: string; run: () => void } } = {},
) {
  toastManager.add({
    title,
    data: { tone: opts.tone ?? 'success' },
    timeout: opts.undo ? 8000 : 5000,
    actionProps: opts.undo ? { children: opts.undo.label, onClick: opts.undo.run } : undefined,
  })
}

export const fmt = (d: string | Date | null | undefined, locale: 'fr' | 'en') =>
  d ? formatDate(new Date(d), locale) : '—'

/**
 * Confirmation dialog. `word`: for dangerous actions, the person types this word to enable the button.
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  text,
  confirmLabel,
  danger,
  word,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  text: string
  confirmLabel: string
  danger?: boolean
  word?: string
  busy?: boolean
  onConfirm: () => void
}) {
  const { t } = useLocale()
  const [typed, setTyped] = useState('')
  const id = useId()
  const ready = !word || typed.trim().toLowerCase() === word.toLowerCase()
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setTyped('')
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="dialog eec-dialog">
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
            <Dialog.Description className="text-ink-muted">{text}</Dialog.Description>
            {word && (
              <div className="field">
                <label className="field-label" htmlFor={id}>
                  {t('admin.common.type_to_confirm', { word })}
                </label>
                <input
                  id={id}
                  className="input"
                  placeholder={word}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
              </div>
            )}
            <div className="dialog-actions">
              <Dialog.Close className="btn btn-secondary">{t('admin.common.cancel')}</Dialog.Close>
              <Button
                variant={danger ? 'danger' : 'primary'}
                disabled={!ready}
                loading={busy}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** A dialog holding a form or details (controlled). */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  wide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="sheet eec-sheet" data-side="end" data-wide={wide ? '' : undefined}>
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** A link to hand over (invitation, reset): shown once, with a copy button. */
export function CopyLink({ url, note }: { url: string; note?: string }) {
  const { t } = useLocale()
  return (
    <div className="grid gap-3 rounded-lg bg-surface-2 p-4">
      {note && <p className="text-sm text-ink-muted">{note}</p>}
      <code className="admin-link-box">{url}</code>
      <div>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              notify(t('admin.common.copied'))
            } catch {
              // Clipboard blocked: the link stays selectable on screen.
            }
          }}
        >
          {t('admin.common.copy')}
        </Button>
      </div>
    </div>
  )
}

/** "Mozilla/5.0 (Linux; Android 14…) Chrome/…" → "Chrome · Android". */
export function deviceName(ua: string | null | undefined): string | null {
  if (!ua) return null
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  return [browser, os].filter(Boolean).join(' · ') || null
}
