/**
 * Behaviour for the Astro primitives, on native platform features (<dialog>, [popover], <details>).
 * ~2 KB, no dependency. Event delegation on `document`, installed once — it keeps working after
 * Astro page transitions. Markup contracts are documented in /fr/_brand → Composants.
 */

let installed = false
let toastRegion: HTMLElement | null = null

const q = <T extends Element = HTMLElement>(root: ParentNode, sel: string) =>
  root.querySelector<T>(sel)

/** Position a [popover] under (or over) its trigger, kept inside the viewport. */
function placePopover(pop: HTMLElement, trigger: HTMLElement) {
  const t = trigger.getBoundingClientRect()
  const margin = 8
  const align = pop.dataset.align ?? 'start'
  if (pop.hasAttribute('data-match-width')) pop.style.minWidth = `${t.width}px`
  const width = pop.offsetWidth
  const rtl = getComputedStyle(pop).direction === 'rtl'
  let left = align === 'end' ? (rtl ? t.left : t.right - width) : rtl ? t.right - width : t.left
  left = Math.min(Math.max(margin, left), window.innerWidth - width - margin)
  let top = t.bottom + 6
  if (
    top + pop.offsetHeight > window.innerHeight - margin &&
    t.top - 6 - pop.offsetHeight > margin
  ) {
    top = t.top - 6 - pop.offsetHeight
  }
  pop.style.left = `${left}px`
  pop.style.top = `${top}px`
}

const items = (menu: HTMLElement) => [
  ...menu.querySelectorAll<HTMLElement>(
    '[role^="menuitem"]:not([aria-disabled="true"]), [role="option"]',
  ),
]

/** Slide the tab indicator under the selected tab (CSS spring does the easing). */
function placeIndicator(list: HTMLElement) {
  const indicator = list.querySelector<HTMLElement>('.tabs-indicator')
  const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
  if (!indicator || !tab) return
  indicator.style.setProperty('--tab-left', `${tab.offsetLeft}px`)
  indicator.style.setProperty('--tab-width', `${tab.offsetWidth}px`)
}

function selectTab(tab: HTMLElement, focus = false) {
  const list = tab.closest<HTMLElement>('[role="tablist"]')
  if (!list) return
  for (const other of list.querySelectorAll<HTMLElement>('[role="tab"]')) {
    const selected = other === tab
    other.setAttribute('aria-selected', String(selected))
    other.tabIndex = selected ? 0 : -1
    const panel = other.getAttribute('aria-controls')
    const el = panel ? document.getElementById(panel) : null
    if (el) el.hidden = !selected
  }
  placeIndicator(list)
  if (focus) tab.focus()
}

/** Custom select: the list is a [popover]; a hidden native <select> keeps forms and `change` events working. */
function chooseOption(option: HTMLElement) {
  const list = option.closest<HTMLElement>('[data-select-list]')
  const root = list?.closest<HTMLElement>('[data-select]')
  const native = root?.querySelector<HTMLSelectElement>('select')
  if (!list || !root || !native) return
  native.value = option.dataset.value ?? ''
  for (const o of list.querySelectorAll<HTMLElement>('[role="option"]'))
    o.setAttribute('aria-selected', String(o === option))
  const label = root.querySelector<HTMLElement>('[data-select-value]')
  if (label) {
    label.textContent = option.dataset.label ?? option.textContent ?? ''
    label.removeAttribute('data-placeholder')
  }
  native.dispatchEvent(new Event('change', { bubbles: true }))
  list.hidePopover()
  root.querySelector<HTMLElement>('button.select')?.focus()
}

export type ToastOptions = {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  closeLabel?: string
  ms?: number
}

const CLOSE_ICON =
  '<svg class="toast-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'

/** Newest toast = index 0 (front of the deck). */
function restack() {
  if (!toastRegion) return
  const items = [...toastRegion.querySelectorAll<HTMLElement>('.toast:not([data-leaving])')]
  for (const [i, el] of items.entries()) el.style.setProperty('--i', String(items.length - 1 - i))
}

/** Shows a toast (role=status): a stacked deck, a progress ring around the close button. */
export function toast(
  message: string,
  { tone = 'neutral', closeLabel = 'Close', ms = 5000 }: ToastOptions = {},
) {
  if (!toastRegion?.isConnected) {
    toastRegion = document.createElement('div')
    toastRegion.className = 'toast-region'
    toastRegion.setAttribute('role', 'region')
    toastRegion.setAttribute('aria-label', 'Notifications')
    document.body.append(toastRegion)
  }
  const el = document.createElement('div')
  el.className = 'toast'
  el.dataset.tone = tone
  el.style.setProperty('--toast-ms', `${ms}ms`)
  el.setAttribute('role', tone === 'danger' ? 'alert' : 'status')
  const text = document.createElement('p')
  text.className = 'toast-text'
  text.textContent = message
  const wrap = document.createElement('span')
  wrap.className = 'toast-close'
  wrap.innerHTML =
    '<svg class="toast-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" pathLength="100"/></svg>'
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'btn btn-ghost'
  close.setAttribute('aria-label', closeLabel)
  close.innerHTML = CLOSE_ICON
  wrap.append(close)
  const dismiss = () => {
    if (el.dataset.leaving !== undefined) return
    el.dataset.leaving = ''
    restack()
    window.setTimeout(() => {
      el.remove()
      restack()
    }, 180)
  }
  close.addEventListener('click', dismiss)
  wrap.querySelector('circle')?.addEventListener('animationend', dismiss)
  el.append(text, wrap)
  toastRegion.append(el)
  restack()
  return dismiss
}

export function initPrimitives() {
  if (installed) return
  installed = true

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const open = target.closest<HTMLElement>('[data-dialog-open]')
    if (open) {
      const dialog = document.getElementById(open.dataset.dialogOpen ?? '')
      if (dialog instanceof HTMLDialogElement) dialog.showModal()
      return
    }
    const close = target.closest<HTMLElement>('[data-dialog-close]')
    if (close) {
      close.closest('dialog')?.close()
      return
    }
    // Click on the backdrop (the dialog element itself, outside its content box) closes it.
    if (target instanceof HTMLDialogElement && target.hasAttribute('data-light-dismiss')) {
      const r = target.getBoundingClientRect()
      const inside =
        event.clientX >= r.left &&
        event.clientX <= r.right &&
        event.clientY >= r.top &&
        event.clientY <= r.bottom
      if (!inside) target.close()
      return
    }
    const option = target.closest<HTMLElement>('[data-select-list] [role="option"]')
    if (option) {
      chooseOption(option)
      return
    }
    const tab = target.closest<HTMLElement>('[role="tab"]')
    if (tab) selectTab(tab)
    const menuItem = target.closest<HTMLElement>('[role^="menuitem"][data-close]')
    if (menuItem) menuItem.closest<HTMLElement>('[popover]')?.hidePopover()
    const demoToast = target.closest<HTMLElement>('[data-toast]')
    if (demoToast)
      toast(demoToast.dataset.toast ?? '', {
        tone: (demoToast.dataset.tone as ToastOptions['tone']) ?? 'neutral',
        closeLabel: demoToast.dataset.close ?? 'Close',
      })
  })

  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement
    if (event.key === 'Escape')
      for (const tip of document.querySelectorAll<HTMLElement>('.tip')) tip.dataset.dismissed = ''

    const tab = target.closest<HTMLElement>('[role="tab"]')
    if (tab) {
      const tabs = [
        ...(tab.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []),
      ]
      const i = tabs.indexOf(tab)
      const rtl = getComputedStyle(tab).direction === 'rtl'
      const next =
        event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
          ? tabs[(i + 1) % tabs.length]
          : event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')
            ? tabs[(i - 1 + tabs.length) % tabs.length]
            : event.key === 'Home'
              ? tabs[0]
              : event.key === 'End'
                ? tabs.at(-1)
                : undefined
      if (next) {
        event.preventDefault()
        selectTab(next, true)
      }
      return
    }

    const menu = target.closest<HTMLElement>('[role="menu"], [role="listbox"]')
    if (menu) {
      const list = items(menu)
      const i = list.indexOf(target)
      const move =
        event.key === 'ArrowDown'
          ? list[(i + 1) % list.length]
          : event.key === 'ArrowUp'
            ? list[(i - 1 + list.length) % list.length]
            : event.key === 'Home'
              ? list[0]
              : event.key === 'End'
                ? list.at(-1)
                : undefined
      if (move) {
        event.preventDefault()
        move.focus()
      }
      return
    }

    // Menu button: ArrowDown opens the menu and focuses its first item.
    const trigger = target.closest<HTMLElement>('[popovertarget]')
    if (trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const pop = document.getElementById(trigger.getAttribute('popovertarget') ?? '')
      if (pop?.getAttribute('role') === 'menu' || pop?.getAttribute('role') === 'listbox') {
        event.preventDefault()
        pop.showPopover({ source: trigger })
      }
    }
  })

  for (const type of ['mouseleave', 'focusout']) {
    document.addEventListener(
      type,
      (event) => {
        const tip = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('.tip')
        if (tip) delete tip.dataset.dismissed
      },
      true,
    )
  }

  // `toggle` doesn't bubble: capture it.
  document.addEventListener(
    'toggle',
    (event) => {
      const pop = event.target as HTMLElement
      if (!pop.matches?.('.eec-popover')) return
      const state = (event as ToggleEvent).newState
      const trigger = q(document, `[popovertarget="${pop.id}"]`)
      trigger?.setAttribute('aria-expanded', String(state === 'open'))
      if (state !== 'open') return
      if (trigger) placePopover(pop, trigger)
      // After the browser has finished opening the popover (and its own focus handling).
      requestAnimationFrame(() => {
        const role = pop.getAttribute('role')
        if (role === 'menu') items(pop)[0]?.focus()
        if (role === 'listbox')
          (pop.querySelector<HTMLElement>('[aria-selected="true"]') ?? items(pop)[0])?.focus()
      })
    },
    true,
  )

  const placeAll = () => {
    for (const list of document.querySelectorAll<HTMLElement>('[role="tablist"]'))
      placeIndicator(list)
  }
  placeAll()
  document.fonts?.ready.then(placeAll)
  document.addEventListener('astro:page-load', placeAll)
  window.addEventListener('resize', placeAll)

  window.addEventListener('resize', () => {
    for (const pop of document.querySelectorAll<HTMLElement>('.eec-popover:popover-open')) {
      const trigger = q(document, `[popovertarget="${pop.id}"]`)
      if (trigger) placePopover(pop, trigger)
    }
  })
}
