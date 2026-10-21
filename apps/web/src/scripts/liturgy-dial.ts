/**
 * The liturgical-year dial: selection by pointer (drag around the ring), arrow keys, previous/next buttons.
 * No inertia; reduced motion needs nothing special (the only animation is a CSS transition that is switched off).
 * Approved season texts and the coming Sundays are read from the edge-cached public API; if either is missing the
 * built-in text stays. Text is set with textContent only.
 */
type Season = { season: string; meaning: string; parish: string }
type Sunday = { date: string; name: string; theme: string; season: string }

let seasonsPromise: Promise<Season[]> | null = null
let sundaysPromise: Promise<Sunday[]> | null = null
const getJson = async <T>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { credentials: 'omit' })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

export function initDial() {
  const root = document.querySelector<HTMLElement>('[data-dial]')
  if (!root || root.dataset.ready) return
  root.dataset.ready = '1'
  root.hidden = false
  root.setAttribute('data-dial-enhanced', '')
  const locale = root.dataset.locale ?? 'fr'
  const svg = root.querySelector<SVGSVGElement>('[data-dial-svg]')
  const arcs = [...root.querySelectorAll<SVGPathElement>('.dial-arc')]
  const chips = [...root.querySelectorAll<HTMLButtonElement>('.dial-chip')]
  const panel = root.querySelector<HTMLElement>('[data-dial-panel]')
  const title = root.querySelector<HTMLElement>('[data-dial-title]')
  const text = root.querySelector<HTMLElement>('[data-dial-text]')
  const parish = root.querySelector<HTMLElement>('[data-dial-parish]')
  const sundaysTitle = root.querySelector<HTMLElement>('[data-dial-sundays-title]')
  const sundays = root.querySelector<HTMLElement>('[data-dial-sundays]')
  const name = root.querySelector<HTMLElement>('[data-dial-name]')
  if (!svg || !panel || !title || !text || !chips.length) return
  // The static list of seasons is for people without JavaScript.
  for (const el of document.querySelectorAll<HTMLElement>('.pv-seasons-list')) el.hidden = true

  const base = locale === 'fr' ? '/fr/agenda/ce-dimanche/' : '/en/calendar/this-sunday/'
  let selected = -1
  const select = async (i: number, focus = false) => {
    const n = ((i % chips.length) + chips.length) % chips.length
    if (n === selected) return
    selected = n
    const chip = chips[n] as HTMLButtonElement
    for (const [j, c] of chips.entries()) {
      c.setAttribute('aria-checked', String(j === n))
      c.tabIndex = j === n ? 0 : -1
    }
    for (const [j, a] of arcs.entries()) {
      if (j === n) a.setAttribute('data-selected', '')
      else a.removeAttribute('data-selected')
    }
    const season = chip.dataset.season ?? ''
    panel.setAttribute('data-season', season)
    panel.classList.remove('dial-panel-swap')
    void panel.offsetWidth
    panel.classList.add('dial-panel-swap')
    title.textContent = chip.dataset.title ?? ''
    if (name) name.textContent = chip.dataset.title ?? ''
    text.textContent = chip.dataset.text ?? ''
    if (parish) parish.hidden = true
    if (sundaysTitle) sundaysTitle.hidden = true
    if (sundays) sundays.replaceChildren()
    if (focus) chip.focus()
    seasonsPromise ??= getJson<{ items: Season[] }>(
      `/api/liturgy/public/seasons?locale=${locale}`,
    ).then((r) => r?.items ?? [])
    sundaysPromise ??= getJson<{ items: Sunday[] }>(
      `/api/liturgy/public/sundays?locale=${locale}`,
    ).then((r) => r?.items ?? [])
    const [seasons, list] = await Promise.all([seasonsPromise, sundaysPromise])
    if (selected !== n) return
    const approved = seasons.find((s) => s.season === season)
    if (approved?.meaning) text.textContent = approved.meaning
    if (approved?.parish && parish) {
      parish.textContent = approved.parish
      parish.hidden = false
    }
    const today = new Date().toISOString().slice(0, 10)
    const coming = list.filter((s) => s.season === season && s.date >= today).slice(0, 4)
    if (coming.length && sundays && sundaysTitle) {
      for (const s of coming) {
        const li = document.createElement('li')
        const a = document.createElement('a')
        a.href = base
        a.textContent = `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${s.date}T00:00:00Z`))} — ${s.name}`
        li.append(a)
        sundays.append(li)
      }
      sundaysTitle.hidden = false
    }
  }

  for (const [i, c] of chips.entries()) c.addEventListener('click', () => select(i))
  root
    .querySelector('[data-dial-prev]')
    ?.addEventListener('click', () => select(selected - 1, false))
  root
    .querySelector('[data-dial-next]')
    ?.addEventListener('click', () => select(selected + 1, false))
  root.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key
    if (k === 'ArrowRight' || k === 'ArrowDown') {
      e.preventDefault()
      select(selected + 1, true)
    } else if (k === 'ArrowLeft' || k === 'ArrowUp') {
      e.preventDefault()
      select(selected - 1, true)
    }
  })

  // Drag around the ring: the arc under the pointer's angle is selected.
  const fractionAt = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect()
    const a =
      Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) +
      Math.PI / 2
    return (((a / (Math.PI * 2)) % 1) + 1) % 1
  }
  const arcAt = (f: number) => {
    const idx = root.querySelectorAll<SVGPathElement>('.dial-arc') as NodeListOf<SVGPathElement>
    // Arcs are in year order and cover the year: find by the stored fractions.
    return [...idx].findIndex((a) => {
      const from = Number(a.dataset.from)
      const to = Number(a.dataset.to)
      return f >= from && f < to
    })
  }
  let dragging = false
  svg.addEventListener('pointerdown', (e) => {
    dragging = true
    svg.setPointerCapture(e.pointerId)
    const i = arcAt(fractionAt(e))
    if (i >= 0) select(i)
  })
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const i = arcAt(fractionAt(e))
    if (i >= 0) select(i)
  })
  const stop = () => (dragging = false)
  svg.addEventListener('pointerup', stop)
  svg.addEventListener('pointercancel', stop)

  const start = chips.findIndex((c) => c.dataset.season === root.dataset.current)
  select(start >= 0 ? start : 0)
}
