/**
 * The agenda's controls (list / month, period, group, month arrows, dates) change only the results, not the page:
 * the new address is fetched, the part under the hero is swapped in place, and the address bar and history follow.
 * Without JavaScript the same links are ordinary page loads. A small scroll-spy keeps the week index in step.
 */
let bound = false

async function swap(url: string, push: boolean) {
  const app = document.querySelector<HTMLElement>('[data-ev-app]')
  if (!app) {
    location.href = url
    return
  }
  app.setAttribute('data-busy', '')
  try {
    const res = await fetch(url, { headers: { accept: 'text/html' } })
    if (!res.ok) throw new Error(String(res.status))
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
    const next = doc.querySelector('[data-ev-app]')
    if (!next) throw new Error('no app')
    app.innerHTML = next.innerHTML
    if (push) history.pushState({ ev: true }, '', url)
    spy()
  } catch {
    location.href = url
  } finally {
    app.removeAttribute('data-busy')
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

export function initEventsNav() {
  spy()
  if (bound || !document.querySelector('[data-ev-app]')) return
  bound = true
  // Capture phase, so the site's page transitions never see these clicks.
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-ev-nav]')
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      e.stopImmediatePropagation()
      void swap(a.href, true)
    },
    true,
  )
  document.addEventListener(
    'submit',
    (e) => {
      const form = (e.target as HTMLElement).closest<HTMLFormElement>('form[data-ev-form]')
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
    if (document.querySelector('[data-ev-app]')) void swap(location.href, false)
  })
}
