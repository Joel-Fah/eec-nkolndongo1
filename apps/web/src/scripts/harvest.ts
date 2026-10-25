/**
 * The harvest page (decision 0042): sections settle in as they come into view, the basket fills and the fruit land, the amount counts
 * up. Plain IntersectionObserver and requestAnimationFrame, no library. Without this script, with reduced motion or with Save-Data,
 * everything is simply there from the start.
 */
const calm = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count)
  if (!Number.isFinite(target) || target <= 0) return
  const nf = new Intl.NumberFormat(
    el.closest<HTMLElement>('[data-locale]')?.dataset.locale === 'en' ? 'en-GB' : 'fr-FR',
  )
  const t0 = performance.now()
  const dur = 2200
  const tick = (now: number) => {
    const k = Math.min((now - t0) / dur, 1)
    // Slows down as it arrives, like the basket.
    const eased = 1 - (1 - k) ** 3
    el.textContent = `${nf.format(Math.round(target * eased))} FCFA`
    if (k < 1) requestAnimationFrame(tick)
  }
  el.textContent = `0 FCFA`
  requestAnimationFrame(tick)
}

export function initHarvest() {
  const root = document.querySelector<HTMLElement>('.hv[data-harvest]')
  if (!root || root.dataset.ready) return
  root.dataset.ready = '1'
  const items = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
  if (calm() || !('IntersectionObserver' in window)) return
  root.setAttribute('data-js', '')
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        el.setAttribute('data-in', '')
        const n = el.querySelector<HTMLElement>('[data-count]')
        if (n) setTimeout(() => countUp(n), 400)
        io.unobserve(el)
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  )
  for (const el of items) io.observe(el)
}
