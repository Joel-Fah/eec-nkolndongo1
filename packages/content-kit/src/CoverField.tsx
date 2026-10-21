/** The main photo of an item: pick from the library, change, remove. */
import { api, useLocale } from '@eec/admin-kit'
import { Button } from '@eec/ui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { MediaPicker, mediaSrc } from './MediaPicker.tsx'

export function CoverField({
  mediaId,
  onChange,
}: {
  mediaId: string | null
  onChange: (id: string | null) => void
}) {
  const { t } = useLocale()
  const [picking, setPicking] = useState(false)
  const media = useQuery({
    queryKey: ['media', mediaId],
    enabled: !!mediaId,
    queryFn: () =>
      api<{ variants: { key: string; width: number; mime: string }[] }>(`/media/${mediaId}`),
  })
  return (
    <div className="cover-field">
      <span className="field-label">{t('content.cover.label')}</span>
      {mediaId && media.data ? (
        <img className="cover-preview" src={mediaSrc(media.data, 480)} alt="" />
      ) : (
        <p className="text-sm text-ink-muted">{t('content.cover.none')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
          {t(mediaId ? 'content.cover.change' : 'content.cover.choose')}
        </Button>
        {mediaId && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t('content.cover.remove')}
          </Button>
        )}
      </div>
      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(m) => {
          onChange(m.id)
          setPicking(false)
        }}
      />
    </div>
  )
}
