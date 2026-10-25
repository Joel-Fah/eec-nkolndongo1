/**
 * Installable and a little offline (decision 0037): registers the service worker, shows « copy saved on this device » when a page was
 * served from the cache, and offers « Installer l'application » (no banner: only these quiet entries, hidden until they apply).
 */
type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}
let deferred: InstallEvent | null = null

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
const ios = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

function paint() {
  const done = standalone()
  for (const b of document.querySelectorAll<HTMLElement>('[data-install]'))
    b.hidden = done || !deferred
  for (const b of document.querySelectorAll<HTMLElement>('[data-install-ios]'))
    b.hidden = done || deferred !== null || !ios()
  // A page that came from the saved copies says so, discreetly.
  const badge = document.querySelector<HTMLElement>('[data-offline-badge]')
  if (badge) badge.hidden = !document.querySelector('meta[name="eec-from-cache"]')
}

export function initPwa() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost') {
    // On localhost the worker is only registered when asked (?sw=1), so development never meets a stale copy by accident.
    if (!(location.hostname === 'localhost' && new URLSearchParams(location.search).has('sw')))
      return paint()
  }
  window.addEventListener(
    'load',
    () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {}),
    { once: true },
  )
  paint()
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallEvent
  paint()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  paint()
})
document.addEventListener('astro:page-load', paint)
document.addEventListener('click', async (e) => {
  if (!(e.target as Element | null)?.closest('[data-install]') || !deferred) return
  const ev = deferred
  deferred = null
  paint()
  await ev.prompt()
  await ev.userChoice
})
