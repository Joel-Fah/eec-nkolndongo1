/** Chooses a photo from the media library (one place for every module, so none re-implements the grid). */
import { Dialog } from '@base-ui/react/dialog'
import { api, useLocale } from '@eec/admin-kit'
import { Button, EmptyState, TextField } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

type Variant = { key: string; width: number; mime: string }
type Item = {
  id: string
  originalName: string
  width: number | null
  height: number | null
  variants: Variant[]
  altFr: string | null
  altEn: string | null
  credit: string | null
}

export type PickedMedia = {
  id: string
  src: string
  alt: string
  credit: string | null
  width: number | null
  height: number | null
}

const thumbOf = (m: Item) => [...m.variants].sort((a, b) => a.width - b.width)[0]
const largestOf = (m: Item) => [...m.variants].sort((a, b) => b.width - a.width)[0]
export const mediaSrc = (m: Pick<Item, 'variants'>, width = 960) => {
  const sorted = [...m.variants].sort((a, b) => a.width - b.width)
  const v = sorted.find((x) => x.width >= width) ?? sorted.at(-1)
  return v ? `/media/${v.key}` : ''
}

export function MediaPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (m: PickedMedia) => void
}) {
  const { t, locale } = useLocale()
  const [q, setQ] = useState('')
  const list = useQuery({
    queryKey: ['media', 'picker', q],
    enabled: open,
    queryFn: () =>
      api<{ items: Item[] }>(`/media?kind=image${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  })
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup className="dialog eec-dialog picker-dialog">
          <div className="dialog-body">
            <Dialog.Title className="dialog-title">{t('content.picker.title')}</Dialog.Title>
            <TextField
              label={t('content.picker.search')}
              placeholder={t('content.picker.search_ph')}
              icon="search"
              type="search"
              value={q}
              onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
            />
            {list.data && list.data.items.length === 0 && (
              <EmptyState title={t('content.picker.empty')} text={t('content.picker.empty_help')} />
            )}
            <ul className="picker-grid">
              {(list.data?.items ?? []).map((m) => {
                const thumb = thumbOf(m)
                const alt = (locale === 'en' ? m.altEn : m.altFr) ?? m.altFr ?? m.altEn ?? ''
                if (!thumb) return null
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="picker-tile"
                      onClick={() => {
                        const big = largestOf(m)
                        onPick({
                          id: m.id,
                          src: mediaSrc(m),
                          alt: m.altFr ?? m.altEn ?? '',
                          credit: m.credit,
                          width: big?.width ?? m.width,
                          height:
                            m.width && m.height && big
                              ? Math.round((big.width * m.height) / m.width)
                              : m.height,
                        })
                      }}
                    >
                      <img src={`/media/${thumb.key}`} alt={alt} loading="lazy" />
                      {!alt && <span className="picker-warn">{t('content.picker.no_alt')}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={onClose}>
                {t('content.picker.cancel')}
              </Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
