import { useLocale } from '@eec/admin-kit'
import { type ReactNode, useMemo, useState } from 'react'
import { Brand } from './Brand'
import { LocaleSwitch, ThemeButton } from './Controls'

/**
 * Sign-in, invitation and reset screens: the whole viewport. Left, a photo (random, dev-only placeholders —
 * a textured panel when there is none, as in production) with a verse; right, the form.
 */
const PHOTOS = [
  17290989, 31326469, 36937754, 18487803, 10438600, 9056625, 37088368, 8270597, 19783489,
]

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useLocale()
  const photo = useMemo(() => PHOTOS[Math.floor(Math.random() * PHOTOS.length)], [])
  const [missing, setMissing] = useState(false)
  return (
    <div className="auth">
      <aside className="auth-art" aria-hidden="true">
        {!missing && (
          <img
            src={`/placeholders/place/${photo}-h-1920.webp`}
            alt=""
            onError={(e) => {
              const img = e.currentTarget
              // The photo may be a "people" one: try that folder before giving up (production has none).
              if (img.dataset.tried) setMissing(true)
              else {
                img.dataset.tried = '1'
                img.src = `/placeholders/people/${photo}-h-1920.webp`
              }
            }}
          />
        )}
        <div className="auth-art-scrim" />
        <figure className="auth-verse">
          <blockquote>{t('home.verse')}</blockquote>
          <figcaption>{t('home.verse_cite')}</figcaption>
        </figure>
      </aside>
      <div className="auth-side">
        <div className="auth-top">
          <Brand />
          <div className="flex items-center gap-1">
            <LocaleSwitch />
            <ThemeButton />
          </div>
        </div>
        <div className="auth-main">{children}</div>
        <p className="auth-foot">{t('footer.rights')}</p>
      </div>
    </div>
  )
}
