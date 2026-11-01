/**
 * « Mon espace » for a signed-in member (plan: docs/product/mon-espace.md): five sections shown one at a time, each reachable by its
 * anchor (#accueil, #inscriptions, #groupes, #notifications, #profil) and loaded only when first opened, so the page stays a small island.
 * Everything is private: drawn from /api/me/*, nothing kept in storage.
 */
import { avatarSvg } from '@eec/ui/avatar-art'
import { api, type Ctx, forgetProfile, type Links, type Msgs, profile, setIcons } from './me-api'

const IDS = ['accueil', 'inscriptions', 'groupes', 'notifications', 'profil'] as const
type Id = (typeof IDS)[number]

export function initMonEspace(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>('[data-me]')
  if (!host || host.dataset.ready) return
  host.dataset.ready = '1'
  const ctx: Ctx = {
    root: host,
    msgs: JSON.parse(host.dataset.msgs ?? '{}') as Msgs,
    links: JSON.parse(host.dataset.links ?? '{}') as Links,
    lang: host.dataset.lang ?? 'fr',
  }
  setIcons(JSON.parse(host.dataset.icons ?? '{}') as Record<string, string>)
  const loaded = new Set<Id>()
  let notifsAt = 0
  const section = (id: Id) => host.querySelector<HTMLElement>(`[data-me-section="${id}"]`)
  const count = host.querySelector<HTMLElement>('[data-me-count]')
  const setCount = (n: number) => {
    if (!count) return
    count.hidden = n <= 0
    count.textContent = n > 99 ? '99+' : String(n)
  }

  async function load(id: Id) {
    const box = section(id)?.querySelector<HTMLElement>('.me-cards')
    if (id === 'profil' || !box) return
    if (id === 'accueil') return (await import('./me-home')).initHome(ctx, box, show)
    if (id === 'inscriptions')
      return (await import('./me-regs')).initRegs(ctx, box, () => void load('accueil'))
    if (id === 'groupes')
      return (await import('./me-groups')).initGroups(ctx, box, () => void load('accueil'))
    notifsAt = Date.now()
    return (await import('./me-notifs')).initNotifs(ctx, box, setCount)
  }

  function show(raw: string, push = true) {
    const id = (IDS as readonly string[]).includes(raw) ? (raw as Id) : 'accueil'
    for (const i of IDS) section(i)?.toggleAttribute('hidden', i !== id)
    for (const a of host?.querySelectorAll<HTMLElement>('[data-me-tab]') ?? [])
      if (a.dataset.meTab === id) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    if (push && location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`)
    if (!loaded.has(id)) {
      loaded.add(id)
      void load(id)
    } else if (id === 'notifications' && Date.now() - notifsAt > 30_000) void load(id)
  }

  for (const a of host.querySelectorAll<HTMLAnchorElement>('[data-me-tab]'))
    a.addEventListener('click', (e) => {
      e.preventDefault()
      show(a.dataset.meTab ?? 'accueil')
      window.scrollTo({
        top: Math.max(0, host.getBoundingClientRect().top + scrollY - 90),
        behavior: 'smooth',
      })
    })
  addEventListener('hashchange', () => show(location.hash.slice(1), false))
  show(location.hash.slice(1) || 'accueil', false)
  // The welcome: the member's own picture if they have one, else the generated avatar; soft shapes follow the pointer.
  const hero = root.querySelector<HTMLElement>('[data-me-hero]')
  const paintHero = () =>
    void profile().then((r) => {
      const box = hero?.querySelector<HTMLElement>('[data-hero-avatar]')
      if (!box || !r.ok) return
      const fallback = () =>
        box.replaceChildren(
          Object.assign(document.createElement('span'), { innerHTML: avatarSvg(r.json.seed) }),
        )
      if (!r.json.photo.url) return fallback()
      const img = Object.assign(new Image(96, 96), {
        src: r.json.photo.url,
        alt: '',
        referrerPolicy: 'no-referrer',
      })
      img.addEventListener('error', fallback)
      box.replaceChildren(img)
    })
  paintHero()
  addEventListener('eec:profile-changed', () => {
    forgetProfile()
    paintHero()
    loaded.delete('accueil')
    if (!section('accueil')?.hidden) show('accueil', false)
  })
  // The menu gets its headline once the welcome has scrolled away.
  if (hero && 'IntersectionObserver' in window)
    new IntersectionObserver(([e]) => host.toggleAttribute('data-past-hero', !e?.isIntersecting), {
      rootMargin: '-80px 0px 0px 0px',
    }).observe(hero)
  // Warm the other sections once the first one is drawn, so switching tabs is instant afterwards.
  const warm = () => {
    for (const id of IDS)
      if (!loaded.has(id)) {
        loaded.add(id)
        void load(id)
      }
  }
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 })
  else setTimeout(warm, 1500)
  // The unread count on the Notifications tab, without opening it.
  void api<{ unread: number }>('/me/notifications').then((r) => r.ok && setCount(r.json.unread))
}
