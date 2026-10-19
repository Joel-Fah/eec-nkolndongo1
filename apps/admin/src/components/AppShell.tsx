import { Menu } from '@base-ui/react/menu'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useT } from '../lib/locale'
import { groups } from '../lib/nav'
import { CommandPalette } from './CommandPalette'
import { LocaleSwitch, ThemeButton } from './Controls'
import { Icon } from './Icon'
import { Mark } from './Mark'

const COLLAPSE_KEY = 'eec-admin-sidebar'

export function AppShell() {
  const t = useT()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [palette, setPalette] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const path = useRouterState({ select: (s) => s.location.pathname })
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })
  const to = (id: string) => (id === 'ui' ? '/ui' : `/p/${id}`)

  return (
    <div
      className="admin-shell"
      data-collapsed={collapsed ? '' : undefined}
      data-mobile-open={mobileOpen ? '' : undefined}
    >
      <a className="skip-link" href="#main">
        {t('admin.skip')}
      </a>
      <aside className="admin-sidebar" aria-label={t('admin.sidebar')}>
        <div className="admin-brand">
          <Link to="/" aria-label={t('admin.dashboard')} className="admin-brand-link">
            <Mark className="admin-mark" />
            <span className="admin-brand-text">{t('site.name')}</span>
          </Link>
        </div>
        <nav className="admin-nav">
          <Link
            to="/"
            className="admin-link"
            activeOptions={{ exact: true }}
            activeProps={{ 'aria-current': 'page' }}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? t('admin.dashboard') : undefined}
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
                  to={to(i.id)}
                  className="admin-link"
                  activeProps={{ 'aria-current': 'page' }}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? t(i.label) : undefined}
                >
                  <Icon name={i.icon} />
                  <span>{t(i.label)}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="btn btn-ghost admin-collapse"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('admin.expand') : t('admin.collapse')}
          title={collapsed ? t('admin.expand') : t('admin.collapse')}
        >
          <span
            style={{
              display: 'inline-flex',
              transform: collapsed ? 'rotate(0)' : 'rotate(180deg)',
            }}
          >
            <Icon name="arrowRight" />
          </span>
          <span className="admin-collapse-text">{t('admin.collapse')}</span>
        </button>
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
            <LocaleSwitch />
            <ThemeButton />
            <Menu.Root>
              <Menu.Trigger className="btn btn-ghost admin-user" aria-label={t('admin.user.menu')}>
                <span className="avatar" aria-hidden="true">
                  EE
                </span>
                <span className="eec-chevron" aria-hidden="true" />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner sideOffset={8} align="end" className="eec-positioner">
                  <Menu.Popup className="eec-popover eec-popup">
                    <p className="px-3 py-2 text-sm font-medium">{t('admin.user.name')}</p>
                    <Menu.Item className="menu-item" disabled>
                      {t('admin.user.profile')}
                    </Menu.Item>
                    <Menu.Item className="menu-item" disabled>
                      {t('admin.user.signout')}
                    </Menu.Item>
                    <p className="px-3 py-2 text-xs text-ink-muted">{t('admin.user.pending')}</p>
                    <Menu.LinkItem className="menu-item" render={<Link to="/login" />}>
                      {t('login.title')}
                    </Menu.LinkItem>
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
    </div>
  )
}
