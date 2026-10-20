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

/** Clip shapes for the small-screen cluster (objectBoundingBox units, so each stretches to its tile). */
const CLUSTER = [
  { id: 'arch', d: 'M0 1V0.5C0 0.22 0.22 0 0.5 0 0.78 0 1 0.22 1 0.5V1Z' },
  {
    id: 'blob',
    d: 'M0.52 0.02C0.74 0 0.96 0.14 0.98 0.38 1 0.6 0.9 0.8 0.7 0.92 0.52 1.02 0.28 0.98 0.14 0.84 0 0.7-0.02 0.46 0.08 0.28 0.18 0.1 0.34 0.04 0.52 0.02Z',
  },
  { id: 'leaf', d: 'M0 1C0 0.45 0.42 0 1 0 1 0.55 0.58 1 0 1Z' },
  { id: 'drop', d: 'M0 0H0.5A0.5 0.5 0 0 1 1 0.5 0.5 0.5 0 0 1 0.5 1 0.5 0.5 0 0 1 0 0.5Z' },
] as const

function Photo({ id, size = 1920 }: { id: number; size?: number }) {
  const [gone, setGone] = useState(false)
  if (gone) return null
  return (
    <img
      src={`/placeholders/place/${id}-h-${size}.webp`}
      alt=""
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget
        // The photo may be a "people" one: try that folder before giving up (production has none).
        if (img.dataset.tried) setGone(true)
        else {
          img.dataset.tried = '1'
          img.src = `/placeholders/people/${id}-h-${size}.webp`
        }
      }}
    />
  )
}

export function AuthShell({ children }: { children: ReactNode }) {
  const { t, locale } = useLocale()
  const photo = useMemo(() => PHOTOS[Math.floor(Math.random() * PHOTOS.length)], [])
  const quote = useMemo(() => pickQuote(), [])
  const others = useMemo(() => PHOTOS.filter((x) => x !== photo).slice(0, 4), [photo])
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
          <Photo id={photo} />
          <div className="auth-art-scrim" />
          <figure className="auth-verse">
            {quote.kind === 'verse' ? (
              <>
                <blockquote>{t(quote.text)}</blockquote>
                <figcaption>
                  {t(quote.cite)} · {t(locale === 'fr' ? 'bible.pdv' : 'bible.etr')}
                </figcaption>
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
        <div className="auth-cluster" aria-hidden="true">
          <svg width="0" height="0" focusable="false" role="presentation">
            {CLUSTER.map((c) => (
              <clipPath key={c.id} id={`auth-${c.id}`} clipPathUnits="objectBoundingBox">
                <path d={c.d} />
              </clipPath>
            ))}
          </svg>
          {CLUSTER.map((c, i) => (
            <div key={c.id} className="auth-shape" style={{ clipPath: `url(#auth-${c.id})` }}>
              <Photo id={others[i] ?? photo} size={1280} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
