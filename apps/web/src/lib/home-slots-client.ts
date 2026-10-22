/**
 * Home texts and key figures as content slots (decision 0039). The home page and the footer stay static; this script
 * asks the edge-cached /api/story/public (published slots only) and replaces the built-in line where a slot is
 * published. Figures are facts: they are hidden until a figure is published (= validated), then shown with a count-up.
 * Everything is set with textContent. If the API is slow or down, the page keeps its built-in text and no figures.
 */
type Slots = Record<string, Record<string, { text: string }>>

const loads = new Map<string, Promise<Slots | null>>()
const load = (locale: string) => {
  if (!loads.has(locale))
    loads.set(
      locale,
      fetch(`/api/story/public?locale=${locale}`, { credentials: 'omit' })
        .then((r) => (r.ok ? (r.json() as Promise<{ slots: Slots }>) : null))
        .then((j) => j?.slots ?? null)
        .catch(() => null),
    )
  return loads.get(locale) as Promise<Slots | null>
}

export async function applyHomeSlots() {
  const marked = document.querySelectorAll<HTMLElement>('[data-slot]')
  const figures = document.querySelector<HTMLElement>('[data-home-figures]')
  if (!marked.length && !figures) return
  const locale = document.documentElement.lang === 'en' ? 'en' : 'fr'
  const slots = await load(locale)
  const home = slots?.home
  if (!home) return
  for (const el of marked) {
    const [page, key] = (el.dataset.slot ?? '').split('.')
    const text = page === 'home' && key ? home[key]?.text : ''
    if (text) el.textContent = text
  }
  if (!figures) return
  let shown = 0
  for (const item of figures.querySelectorAll<HTMLElement>('[data-fig]')) {
    const key = `fig_${item.dataset.fig}`
    const text = home[key]?.text
    if (!text || !/^\d{1,6}$/.test(text)) continue
    const value = item.querySelector<HTMLElement>('.home-stat-value')
    const suffix = item.querySelector<HTMLElement>('[data-fig-suffix]')
    if (!value) continue
    value.textContent = text
    value.dataset.count = text
    if (suffix) suffix.textContent = item.dataset.suffix ?? ''
    item.hidden = false
    shown++
  }
  figures.hidden = shown === 0
  if (shown) window.dispatchEvent(new Event('eec:figures'))
}
