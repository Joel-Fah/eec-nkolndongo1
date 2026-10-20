/**
 * Header behaviour: mega-panels (hover-intent ≈ 120 ms, click/Enter/Space, Esc, arrow keys, outside
 * click), droplet merge of the pods, tuck away on scroll down (a glimpse stays) / reveal on scroll up, hover or tap. Re-initialised after every
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

  // The three pods (two on phones) join like water droplets over the first 140 px of scroll, and part again
  // on the way back up. `--merge` goes 0 → 1; the goo layer behind the pods draws the joined shape.
  const bar = header.querySelector<HTMLElement>('.site-header-bar')
  const goo = header.querySelector<HTMLElement>('[data-goo]')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const MERGE_PX = 140
  const measure = () => {
    if (!bar || !goo) return
    const pods = [...bar.querySelectorAll<HTMLElement>('.site-pod')].filter(
      (x) => x.offsetWidth > 0,
    )
    goo.replaceChildren(
      ...pods.map((pod) => {
        const blob = document.createElement('div')
        blob.className = 'site-goo-blob'
        blob.dataset.pod = pod.dataset.pod ?? ''
        Object.assign(blob.style, {
          left: `${pod.offsetLeft}px`,
          top: `${pod.offsetTop}px`,
          width: `${pod.offsetWidth}px`,
          height: `${pod.offsetHeight}px`,
        })
        return blob
      }),
    )
    const overlap = 8
    const gap = (i: number) => {
      const a = pods[i]
      const b = pods[i + 1]
      return a && b ? Math.max(0, b.offsetLeft - (a.offsetLeft + a.offsetWidth)) : 0
    }
    // Three pods: the outer ones travel to the middle one. Two pods: both travel half way.
    const [dl, dr] =
      pods.length === 3
        ? [gap(0) + overlap, gap(1) + overlap]
        : [gap(0) / 2 + overlap / 2, gap(0) / 2 + overlap / 2]
    header.style.setProperty('--dl', `${dl}px`)
    header.style.setProperty('--dr', `${dr}px`)
    header.setAttribute('data-goo', '')
  }
  measure()
  if (bar && 'ResizeObserver' in window) new ResizeObserver(measure).observe(bar)
  document.fonts?.ready.then(measure)

  // Away from the top the bar tucks away on scroll down, leaving a glimpse of its lower edge; scrolling up,
  // hovering it (mouse) or tapping the glimpse (touch) brings it back.
  const fine = matchMedia('(hover: hover) and (pointer: fine)')
  let lastY = window.scrollY
  let ticking = false
  let hovered = false
  const update = () => {
    const y = window.scrollY
    const p = Math.min(1, Math.max(0, y / MERGE_PX))
    header.style.setProperty(
      '--merge',
      reduced.matches ? (y > 40 ? '1' : '0') : String(p * p * (3 - 2 * p)),
    )
    header.toggleAttribute('data-scrolled', y > 8)
    const menuOpen = menus.some(isOpen) || document.querySelector('dialog[open]')
    const hide =
      y > lastY &&
      y > MERGE_PX + 40 &&
      !menuOpen &&
      !hovered &&
      !header.contains(document.activeElement)
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
  header.addEventListener('pointerover', () => {
    if (!fine.matches) return
    hovered = true
    header.removeAttribute('data-hidden')
  })
  header.addEventListener('pointerleave', () => {
    hovered = false
  })
  // Touch: the first tap on the tucked-away bar only brings it back (nothing underneath is activated).
  header.addEventListener(
    'click',
    (e) => {
      if (!header.hasAttribute('data-hidden')) return
      e.preventDefault()
      e.stopPropagation()
      header.removeAttribute('data-hidden')
    },
    true,
  )
  update()
}
