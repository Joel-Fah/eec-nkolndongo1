import { Dialog } from '@base-ui/react/dialog'
import { useLocale } from '@eec/admin-kit'
import { Button } from '@eec/ui/react'

export function ConfirmDialog({
  open,
  onClose,
  title,
  text,
  confirmLabel,
  danger,
  busy,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  text: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
}) {
  const { t } = useLocale()
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="dialog eec-dialog">
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
            <p>{text}</p>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={onClose}>
                {t('content.picker.cancel')}
              </Button>
              <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
