/**
 * Search in the brand guide (Ctrl+K / ⌘K). Indexes the page's own headings (sections, components, sub-sections)
 * and the first line of each component's description; no server, no dependency. Arrow keys move, Enter goes there,
 * Esc closes. Diacritics and case are ignored.
 */
type Entry = { id: string; label: string; group: string; text: string; el: HTMLElement }

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function initBrandSearch() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-brand-search]')
  const input = dialog?.querySelector<HTMLInputElement>('[data-brand-search-input]')
  const list = dialog?.querySelector<HTMLElement>('[data-brand-search-list]')
  const empty = dialog?.querySelector<HTMLElement>('[data-brand-search-empty]')
  if (!dialog || !input || !list || !empty) return

  let entries: Entry[] = []
  const build = () => {
    entries = []
    let group = ''
    for (const h of document.querySelectorAll<HTMLElement>('main h2, main h3')) {
      const host = h.closest<HTMLElement>('[id]')
      if (!host || !h.textContent?.trim()) continue
      group = h.closest('section[id]')?.querySelector('h2')?.textContent?.trim() ?? group
      const para = host.querySelector('p')?.textContent ?? ''
      entries.push({
        id: host.id,
        label: h.textContent.trim(),
        group,
        text: norm(`${h.textContent} ${group} ${para}`),
        el: host,
      })
    }
  }

  let shown: Entry[] = []
  let active = 0
  const render = () => {
    const q = norm(input.value).split(/\s+/).filter(Boolean)
    shown = (q.length ? entries.filter((e) => q.every((w) => e.text.includes(w))) : entries).slice(
      0,
      30,
    )
    active = Math.min(active, Math.max(0, shown.length - 1))
    list.replaceChildren(
      ...shown.map((e, i) => {
        const li = document.createElement('li')
        li.className = 'brand-search-item'
        li.id = `brand-hit-${i}`
        li.setAttribute('role', 'option')
        li.setAttribute('aria-selected', String(i === active))
        const strong = document.createElement('strong')
        strong.textContent = e.label
        const small = document.createElement('small')
        small.textContent = e.group === e.label ? '' : e.group
        li.append(strong, small)
        li.addEventListener('mousemove', () => select(i))
        li.addEventListener('click', () => go(e))
        return li
      }),
    )
    input.setAttribute('aria-activedescendant', shown.length ? `brand-hit-${active}` : '')
    empty.hidden = shown.length > 0
  }
  const select = (i: number) => {
    active = i
    for (const [n, li] of [...list.children].entries())
      li.setAttribute('aria-selected', String(n === i))
    input.setAttribute('aria-activedescendant', `brand-hit-${i}`)
    list.children[i]?.scrollIntoView({ block: 'nearest' })
  }
  const go = (e: Entry) => {
    dialog.close()
    history.replaceState(null, '', `#${e.id}`)
    e.el.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
    e.el.classList.remove('brand-found')
    void e.el.offsetWidth
    e.el.classList.add('brand-found')
  }
  const open = () => {
    if (!entries.length) build()
    input.value = ''
    active = 0
    render()
    if (!dialog.open) dialog.showModal()
    input.focus()
  }

  input.addEventListener('input', () => {
    active = 0
    render()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (shown.length)
        select((active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = shown[active]
      if (hit) go(hit)
    }
  })
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
  document.querySelector('[data-brand-search-open]')?.addEventListener('click', open)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      open()
    }
  })
}
