/**
 * Filters, views and pagination on the public site (agenda, departments, news) change only the results, not the page:
 * the new address is fetched, the `[data-live-area]` part is swapped in place, and the address bar and history follow.
 * Without JavaScript the same links are ordinary page loads (pages are rendered on the server, so a link is a request).
 * A small scroll-spy keeps the agenda's week index in step.
 */
let bound = false

async function swap(url: string, push: boolean, scroll = false) {
  const app = document.querySelector<HTMLElement>('[data-live-area]')
  if (!app) {
    location.href = url
    return
  }
  app.setAttribute('data-busy', '')
  app.style.opacity = '0.6'
  app.style.transition = 'opacity 0.15s'
  try {
    const res = await fetch(url, { headers: { accept: 'text/html' } })
    if (!res.ok) throw new Error(String(res.status))
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
    const next = doc.querySelector('[data-live-area]')
    if (!next) throw new Error('no app')
    app.innerHTML = next.innerHTML
    if (push) history.pushState({ ev: true }, '', url)
    spy()
    if (scroll) app.scrollIntoView({ block: 'start', behavior: 'smooth' })
  } catch {
    location.href = url
  } finally {
    app.removeAttribute('data-busy')
    app.style.opacity = ''
  }
}

let observer: IntersectionObserver | undefined
function spy() {
  observer?.disconnect()
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-ev-toc]')]
  if (!links.length) return
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (!visible) return
      for (const a of links) {
        if (`ev-${a.dataset.evToc}` === visible.target.id) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
      }
    },
    { rootMargin: '-15% 0px -70% 0px' },
  )
  for (const a of links) {
    const el = document.getElementById(`ev-${a.dataset.evToc}`)
    if (el) observer.observe(el)
  }
}

export function initLiveNav() {
  spy()
  if (bound || !document.querySelector('[data-live-area]')) return
  bound = true
  // Capture phase, so the site's page transitions never see these clicks.
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-live-nav]')
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      e.stopImmediatePropagation()
      void swap(a.href, true, a.hasAttribute('data-live-scroll'))
    },
    true,
  )
  document.addEventListener(
    'submit',
    (e) => {
      const form = (e.target as HTMLElement).closest<HTMLFormElement>('form[data-live-form]')
      if (!form) return
      e.preventDefault()
      e.stopImmediatePropagation()
      const params = new URLSearchParams(new FormData(form) as unknown as Record<string, string>)
      for (const [k, v] of [...params]) if (!v) params.delete(k)
      void swap(`${form.action}?${params}`, true)
    },
    true,
  )
  window.addEventListener('popstate', () => {
    if (document.querySelector('[data-live-area]')) void swap(location.href, false)
  })
}
