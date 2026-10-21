import { Dialog } from '@base-ui/react/dialog'
import { useLocale, useMe } from '@eec/admin-kit'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { labelOf, navFor } from '../lib/nav'
import { Icon } from './Icon'

/** ⌘K / Ctrl+K quick navigation over the admin routes (a shell: actions come with the modules). */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, locale } = useLocale()
  const me = useMe().data
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = [
      { id: 'dashboard', icon: 'home' as const, text: t('admin.dashboard'), to: '/' },
      ...navFor(me).flatMap((g) =>
        g.items.map((i) => ({ id: i.id, icon: i.icon, text: labelOf(i, t, locale), to: i.path })),
      ),
      { id: 'account', icon: 'account' as const, text: t('admin.items.account'), to: '/account' },
    ]
    return q ? base.filter((r) => r.text.toLowerCase().includes(q)) : base
  }, [query, t, locale, me])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const go = (to: string) => {
    onOpenChange(false)
    navigate({ to })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="eec-backdrop eec-overlay" />
        <Dialog.Popup
          className="dialog eec-dialog palette"
          initialFocus={input}
          aria-label={t('admin.palette.title')}
        >
          <div className="grid gap-2 p-3">
            <input
              ref={input}
              className="input"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                results[active] ? `${listId}-${results[active]?.id}` : undefined
              }
              aria-label={t('admin.palette.title')}
              placeholder={t('admin.palette.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => (results.length ? (a + 1) % results.length : 0))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0))
                } else if (e.key === 'Enter' && results[active]) {
                  e.preventDefault()
                  go(results[active].to)
                }
              }}
            />
            <div
              id={listId}
              role="listbox"
              aria-label={t('admin.palette.title')}
              className="palette-list"
            >
              {results.length === 0 && <p className="menu-item">{t('admin.palette.empty')}</p>}
              {results.map((r, i) => (
                <button
                  type="button"
                  tabIndex={-1}
                  key={r.id}
                  id={`${listId}-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  className="menu-item"
                  data-highlighted={i === active ? '' : undefined}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r.to)}
                >
                  <Icon name={r.icon} />
                  {r.text}
                </button>
              ))}
            </div>
            <p className="px-2 pb-1 text-xs text-ink-muted">{t('admin.palette.hint')}</p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
