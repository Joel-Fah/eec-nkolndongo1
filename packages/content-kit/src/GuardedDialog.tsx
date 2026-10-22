/**
 * A dialog for forms with many fields: closing it by accident (Esc, a click outside, the close button) while
 * something has been typed asks first, so nobody loses their work. Children receive `requestClose` to use for
 * their own « Annuler » button.
 */
import { Dialog } from '@base-ui/react/dialog'
import { useLocale } from '@eec/admin-kit'
import { Button } from '@eec/ui/react'
import { type ReactNode, useState } from 'react'

export function GuardedDialog({
  open,
  onClose,
  dirty,
  title,
  wide,
  children,
}: {
  open: boolean
  onClose: () => void
  dirty: boolean
  title?: string
  wide?: boolean
  children: (requestClose: () => void) => ReactNode
}) {
  const { t } = useLocale()
  const [asking, setAsking] = useState(false)
  const requestClose = () => (dirty ? setAsking(true) : onClose())
  return (
    <>
      <Dialog.Root open={open} onOpenChange={(o) => !o && requestClose()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="eec-backdrop eec-overlay" />
          <Dialog.Popup className={`dialog eec-dialog${wide ? ' picker-dialog' : ''}`}>
            {title && <Dialog.Title className="dialog-title sr-only-title">{title}</Dialog.Title>}
            {children(requestClose)}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={asking} onOpenChange={(o) => !o && setAsking(false)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="eec-backdrop eec-overlay" />
          <Dialog.Popup className="dialog eec-dialog">
            <div className="dialog-body">
              <Dialog.Title className="dialog-title">{t('content.guard.title')}</Dialog.Title>
              <p>{t('content.guard.text')}</p>
              <div className="dialog-actions">
                <Button variant="secondary" onClick={() => setAsking(false)}>
                  {t('content.guard.stay')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setAsking(false)
                    onClose()
                  }}
                >
                  {t('content.guard.leave')}
                </Button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
