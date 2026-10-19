/**
 * Header behaviour: mega-panels (hover-intent ≈ 120 ms, click/Enter/Space, Esc, arrow keys, outside
 * click), hide on scroll down / show on scroll up, translucent → solid. Re-initialised after every
 * Astro page transition. No dependency.
 */
const INTENT_MS = 120
const LEAVE_MS = 220

function close(menu: HTMLElement, returnFocus = false) {
  const trigger = menu.querySelector<HTMLElement>('[data-menu-trigger]')
  const panel = menu.querySelector<HTMLElement>('[data-menu-panel]')
  if (!trigger || !panel) return
  trigger.setAttribute('aria-expanded', 'false')
  panel.hidden = true
  if (returnFocus) trigger.focus()
}

function open(menu: HTMLElement, all: HTMLElement[]) {
  for (const other of all) if (other !== menu) close(other)
  menu.querySelector('[data-menu-trigger]')?.setAttribute('aria-expanded', 'true')
  const panel = menu.querySelector<HTMLElement>('[data-menu-panel]')
  if (panel) panel.hidden = false
}

export function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]')
  if (!header) return
  const menus = [...header.querySelectorAll<HTMLElement>('[data-menu]')]
  const isOpen = (m: HTMLElement) =>
    m.querySelector('[data-menu-trigger]')?.getAttribute('aria-expanded') === 'true'
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)')

  for (const menu of menus) {
    const trigger = menu.querySelector<HTMLElement>('[data-menu-trigger]')
    const links = () => [...menu.querySelectorAll<HTMLElement>('[data-menu-panel] a')]
    let timer = 0

    menu.addEventListener('mouseenter', () => {
      if (!finePointer.matches) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => open(menu, menus), INTENT_MS)
    })
    menu.addEventListener('mouseleave', () => {
      if (!finePointer.matches) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => close(menu), LEAVE_MS)
    })
    trigger?.addEventListener('click', () => (isOpen(menu) ? close(menu) : open(menu, menus)))
    trigger?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        open(menu, menus)
        links()[0]?.focus()
      }
    })
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen(menu)) {
        e.preventDefault()
        close(menu, true)
        return
      }
      const list = links()
      const i = list.indexOf(document.activeElement as HTMLElement)
      if (i === -1) return
      const next =
        e.key === 'ArrowDown'
          ? list[(i + 1) % list.length]
          : e.key === 'ArrowUp'
            ? i === 0
              ? trigger
              : list[i - 1]
            : e.key === 'Home'
              ? list[0]
              : e.key === 'End'
                ? list.at(-1)
                : undefined
      if (next) {
        e.preventDefault()
        next.focus()
      }
    })
    menu.addEventListener('focusout', (e) => {
      if (!menu.contains(e.relatedTarget as Node | null)) close(menu)
    })
  }
  document.addEventListener('click', (e) => {
    for (const menu of menus) if (isOpen(menu) && !menu.contains(e.target as Node)) close(menu)
  })
  // Esc closes an open panel even when it was opened by hover (focus not inside it).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    for (const menu of menus) if (isOpen(menu)) close(menu, menu.contains(document.activeElement))
  })

  // Hide on scroll down, show on scroll up; solid once scrolled.
  let lastY = window.scrollY
  let ticking = false
  const update = () => {
    const y = window.scrollY
    header.toggleAttribute('data-scrolled', y > 8)
    const menuOpen = menus.some(isOpen) || document.querySelector('dialog[open]')
    const hide = y > lastY && y > 120 && !menuOpen && !header.contains(document.activeElement)
    header.toggleAttribute('data-hidden', hide)
    lastY = y
    ticking = false
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    },
    { passive: true },
  )
  header.addEventListener('focusin', () => header.removeAttribute('data-hidden'))
  update()
}
