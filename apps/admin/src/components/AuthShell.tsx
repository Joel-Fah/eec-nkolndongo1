import { useLocale } from '@eec/admin-kit'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { pickQuote } from '../lib/quotes'
import { Brand } from './Brand'
import { LocaleSwitch, ThemeButton } from './Controls'

/**
 * Sign-in, invitation and reset screens: the whole viewport. The page background wraps around a large,
 * rounded photo that floats above it and tilts gently with the pointer. The photo is random (dev-only
 * placeholders — a textured panel when there is none, as in production) with a random verse or testimonial.
 */
const PHOTOS = [
  17290989, 31326469, 36937754, 18487803, 10438600, 9056625, 37088368, 8270597, 19783489,
]

export function AuthShell({ children }: { children: ReactNode }) {
  const { t, locale } = useLocale()
  const photo = useMemo(() => PHOTOS[Math.floor(Math.random() * PHOTOS.length)], [])
  const quote = useMemo(() => pickQuote(), [])
  const [missing, setMissing] = useState(false)
  const stage = useRef<HTMLDivElement>(null)

  // Gentle tilt: the pointer's position, eased every frame (fine pointers, no reduced motion).
  useEffect(() => {
    const el = stage.current
    if (!el) return
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let frame = 0
    const tick = () => {
      x += (tx - x) * 0.07
      y += (ty - y) * 0.07
      el.style.setProperty('--tx', x.toFixed(3))
      el.style.setProperty('--ty', y.toFixed(3))
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(tick) : 0
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      kick()
    }
    const leave = () => {
      tx = 0
      ty = 0
      kick()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [])

  return (
    <div className="auth">
      <div className="auth-stage" ref={stage} aria-hidden="true">
        <div className="auth-art">
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
            {quote.kind === 'verse' ? (
              <>
                <blockquote>{t(quote.text)}</blockquote>
                <figcaption>{t(quote.cite)}</figcaption>
              </>
            ) : (
              <>
                <blockquote>{quote.text[locale]}</blockquote>
                <figcaption>
                  {quote.name} · {quote.role[locale]}
                </figcaption>
              </>
            )}
          </figure>
        </div>
      </div>
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
