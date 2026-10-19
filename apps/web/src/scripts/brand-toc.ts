/**
 * Brand guide sidebar: scrollspy + nested sub-sections.
 * - The active section's link gets the indicator; its <h3> sub-sections unfold beneath it (indented)
 *   and the active one inherits the same indicator.
 * - The page title appears in the sidebar once the page's own title has scrolled away.
 */
const SPY_OFFSET = 150

function slug(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function initBrandToc() {
  const root = document.querySelector<HTMLElement>('[data-toc]')
  if (!root) return
  const heroTitle = document.querySelector<HTMLElement>('main h1')

  type Item = {
    id: string
    li: HTMLElement
    link: HTMLAnchorElement
    section: HTMLElement
    subs: { el: HTMLElement; link: HTMLAnchorElement }[]
  }
  const items: Item[] = []
  for (const li of root.querySelectorAll<HTMLElement>('[data-toc-item]')) {
    const id = li.dataset.tocItem ?? ''
    const section = document.getElementById(id)
    const link = li.querySelector<HTMLAnchorElement>('.toc-link')
    const list = li.querySelector<HTMLElement>('.toc-sub-list')
    if (!section || !link || !list) continue
    const subs: Item['subs'] = []
    section.querySelectorAll<HTMLElement>('h3').forEach((h, n) => {
      if (h.closest('dialog')) return
      if (!h.id) h.id = `${id}-${slug(h.textContent ?? '') || n}`
      const a = document.createElement('a')
      a.className = 'toc-sublink'
      a.href = `#${h.id}`
      a.textContent = (h.textContent ?? '').trim()
      const item = document.createElement('li')
      item.append(a)
      list.append(item)
      subs.push({ el: h, link: a })
    })
    items.push({ id, li, link, section, subs })
  }

  let frame = 0
  const update = () => {
    frame = 0
    const top = (el: HTMLElement) => el.getBoundingClientRect().top
    root.toggleAttribute(
      'data-title',
      heroTitle ? heroTitle.getBoundingClientRect().bottom < 90 : false,
    )
    let active: Item | undefined
    for (const item of items) if (top(item.section) <= SPY_OFFSET) active = item
    for (const item of items) {
      const on = item === active
      item.li.toggleAttribute('data-active', on)
      if (on) item.link.setAttribute('aria-current', 'true')
      else item.link.removeAttribute('aria-current')
      let current: HTMLElement | undefined
      if (on) for (const sub of item.subs) if (top(sub.el) <= SPY_OFFSET) current = sub.el
      for (const sub of item.subs) {
        if (sub.el === current) sub.link.setAttribute('aria-current', 'true')
        else sub.link.removeAttribute('aria-current')
      }
    }
    const here = root.querySelector<HTMLElement>(
      '[aria-current="true"]:last-of-type, .toc-sublink[aria-current="true"]',
    )
    here?.scrollIntoView({ block: 'nearest' })
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update)
  }
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  update()
}
