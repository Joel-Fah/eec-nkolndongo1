import { Menu } from '@base-ui/react/menu'
import { useLocale, useMe, useSessionActions } from '@eec/admin-kit'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { guideForPath } from '../lib/help'
import { labelOf, navFor } from '../lib/nav'
import { Brand } from './Brand'
import { CommandPalette } from './CommandPalette'
import { LocaleSwitch, ThemeButton } from './Controls'
import { Icon } from './Icon'
import { LeavingScreen } from './LeavingScreen'
import { NavProgress } from './Loading'

export function AppShell() {
  const { t, locale } = useLocale()
  const [palette, setPalette] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-nav-open', mobileOpen)
    return () => document.documentElement.removeAttribute('data-nav-open')
  }, [mobileOpen])
  const me = useMe().data
  const { signOut } = useSessionActions()
  const navigate = useNavigate()
  const initials = (me?.user.name ?? '??')
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const groups = navFor(me)

  return (
    <div className="admin-shell" data-mobile-open={mobileOpen ? '' : undefined}>
      <a className="skip-link" href="#main">
        {t('admin.skip')}
      </a>
      <aside className="admin-sidebar" aria-label={t('admin.sidebar')}>
        <div className="admin-brand">
          <Link to="/" aria-label={t('admin.dashboard')} className="admin-brand-link">
            <Brand />
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-icon admin-close"
            onClick={() => setMobileOpen(false)}
            aria-label={t('nav.close_menu')}
          >
            <Icon name="close" size={24} />
          </button>
        </div>
        <nav className="admin-nav">
          <Link
            to="/"
            className="admin-link"
            activeOptions={{ exact: true }}
            activeProps={{ 'aria-current': 'page' }}
            onClick={() => setMobileOpen(false)}
          >
            <Icon name="home" />
            <span>{t('admin.dashboard')}</span>
          </Link>
          {groups.map((g) => (
            <div key={g.id} className="admin-group">
              <p className="admin-group-title">{t(g.label)}</p>
              {g.items.map((i) => (
                <Link
                  key={i.id}
                  to={i.path}
                  className="admin-link"
                  activeProps={{ 'aria-current': 'page' }}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon name={i.icon} />
                  <span>{labelOf(i, t, locale)}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {mobileOpen && (
        <button
          type="button"
          className="admin-scrim"
          aria-label={t('nav.close_menu')}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="admin-main">
        <NavProgress />
        <header className="admin-topbar">
          <button
            type="button"
            className="btn btn-ghost btn-icon admin-burger"
            onClick={() => setMobileOpen(true)}
            aria-label={t('nav.open_menu')}
          >
            <Icon name="menu" size={24} />
          </button>
          <button
            type="button"
            className="btn btn-secondary admin-search"
            onClick={() => setPalette(true)}
            aria-label={t('admin.palette.open')}
          >
            <Icon name="search" size={16} />
            <span className="admin-search-text">{t('admin.palette.placeholder')}</span>
            <kbd className="admin-kbd">⌘K</kbd>
          </button>
          <div className="admin-topbar-tools">
            {guideForPath(path) && (
              <Link
                className="btn btn-ghost btn-icon"
                to="/help/$slug"
                params={{ slug: guideForPath(path)?.slug ?? '' }}
                aria-label={t('admin.help.here')}
                title={t('admin.help.here')}
              >
                <Icon name="help" size={20} />
              </Link>
            )}
            <LocaleSwitch />
            <ThemeButton />
            <Menu.Root>
              <Menu.Trigger className="avatar admin-avatar" aria-label={t('admin.user.menu')}>
                {initials}
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner sideOffset={8} align="end" className="eec-positioner">
                  <Menu.Popup className="eec-popover eec-popup">
                    <div className="grid px-3 py-2">
                      <p className="text-sm font-medium">{me?.user.name}</p>
                      <p className="text-xs text-ink-muted">{me?.user.email}</p>
                    </div>
                    <Menu.LinkItem className="menu-item" render={<Link to="/account" />}>
                      {t('admin.items.account')}
                    </Menu.LinkItem>
                    <Menu.Item
                      className="menu-item menu-item-danger"
                      onClick={async () => {
                        // Feedback at once (the request can take a few seconds), and never flash back too fast.
                        setLeaving(true)
                        await Promise.all([
                          signOut().catch(() => {}),
                          new Promise((r) => setTimeout(r, 1600)),
                        ])
                        navigate({ to: '/login' })
                      }}
                    >
                      {t('admin.user.signout')}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </header>
        <main id="main" className="admin-content" tabIndex={-1} key={path}>
          <Outlet />
        </main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      {leaving && <LeavingScreen />}
    </div>
  )
}
