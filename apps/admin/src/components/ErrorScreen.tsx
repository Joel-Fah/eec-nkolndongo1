import { useLocale, useMe } from '@eec/admin-kit'
import { Link, useRouter } from '@tanstack/react-router'
import { type PointerEvent, useRef } from 'react'
import { Brand } from './Brand'
import { LocaleSwitch, ThemeButton } from './Controls'
import { Icon } from './Icon'
import { Illustration } from './Illustration'

/**
 * An error screen: one screen, no scroll. Dots over the whole viewport that light up around the pointer, a big
 * code, a friendly text, a primary action and a few helpful ones, and the cherry tree at the very bottom,
 * cropped by the screen edge. Same design as the site's 404 (apps/web ErrorScreen.astro): keep them alike.
 * A signed-in member who opens the admin gets the plain 404: the admin does not announce itself.
 */
export function ErrorScreen({
  kind = 'notfound',
  reset,
}: {
  kind?: 'notfound' | 'error'
  reset?: () => void
}) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const router = useRouter()
  const root = useRef<HTMLDivElement>(null)
  const staff = !!me && (me.isSuperAdmin || me.permissions.length > 0)
  const tx = useRef({ x: 0, y: 0, tx: 0, ty: 0, frame: 0 })

  const light = (e: PointerEvent) => {
    const el = root.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const s = tx.current
    s.tx = e.clientX
    s.ty = e.clientY
    el.style.setProperty('--lit', '1')
    if (s.frame) return
    const tick = () => {
      s.x += (s.tx - s.x) * 0.14
      s.y += (s.ty - s.y) * 0.14
      el.style.setProperty('--mx', `${s.x.toFixed(1)}px`)
      el.style.setProperty('--my', `${s.y.toFixed(1)}px`)
      s.frame = Math.hypot(s.tx - s.x, s.ty - s.y) > 0.5 ? requestAnimationFrame(tick) : 0
    }
    s.frame = requestAnimationFrame(tick)
  }

  const site = `/${locale}/`
  const space = locale === 'fr' ? '/fr/mon-espace/' : '/en/my-space/'
  const broke = kind === 'error'
  return (
    <div
      className="err"
      ref={root}
      onPointerMove={light}
      onPointerDown={light}
      onPointerLeave={() => root.current?.style.setProperty('--lit', '0')}
    >
      <header className="err-top">
        <Brand />
        <div className="flex items-center gap-1">
          <LocaleSwitch />
          <ThemeButton />
        </div>
      </header>
      <main id="main" className="err-main">
        <p className="err-code" aria-hidden="true">
          {broke ? '500' : '404'}
        </p>
        <h1 className="err-title">{broke ? t('admin.error.broke_title') : t('notfound.title')}</h1>
        <p className="err-text">{broke ? t('admin.error.broke_text') : t('notfound.text')}</p>
        <div className="err-actions">
          {broke ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={reset ?? (() => router.invalidate())}
            >
              <Icon name="refresh" />
              {t('admin.error.retry')}
            </button>
          ) : staff ? (
            <Link to="/" className="btn btn-primary btn-lg">
              <Icon name="compass" />
              {t('admin.error.dashboard')}
            </Link>
          ) : (
            <a href={site} className="btn btn-primary btn-lg">
              <Icon name="home" />
              {t('admin.error.site')}
            </a>
          )}
          {!broke && !staff && (
            <a href={space} className="btn btn-secondary btn-lg">
              <Icon name="account" />
              {t('admin.error.my_space')}
            </a>
          )}
          {!broke && !me && (
            <Link to="/login" className="btn btn-secondary btn-lg">
              <Icon name="lock" />
              {t('admin.error.login')}
            </Link>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => router.history.back()}
          >
            <Icon name="arrowLeft" />
            {t('admin.error.back')}
          </button>
        </div>
      </main>
      <div className="err-tree">
        <Illustration name={broke ? 'working-from-anywhere' : 'cherry-tree'} />
      </div>
    </div>
  )
}
