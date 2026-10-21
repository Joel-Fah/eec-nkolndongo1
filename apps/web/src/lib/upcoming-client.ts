/**
 * « Prochainement » on the home page and the next-event line in the Agenda menu: small scripts that ask the
 * edge-cached /api/events/public/next, so those pages stay static files. No events, or the API slow or down:
 * nothing is shown. Text is set with textContent only.
 */
type Next = {
  slug: string
  title: string
  startsAt: string
  allDay: boolean
  cancelled: boolean
  location: string
  group: string | null
}
const TZ = 'Africa/Douala'

const fetchNext = async (locale: string, limit: number) => {
  try {
    const res = await fetch(`/api/events/public/next?locale=${locale}&limit=${limit}`, {
      credentials: 'omit',
    })
    if (!res.ok) return []
    return ((await res.json()) as { items: Next[] }).items
  } catch {
    return []
  }
}
const when = (it: Next, locale: string) =>
  new Intl.DateTimeFormat(
    locale,
    it.allDay
      ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
      : {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: TZ,
        },
  ).format(new Date(it.startsAt))

export async function showUpcoming() {
  const root = document.querySelector<HTMLElement>('[data-upcoming]')
  if (!root || root.dataset.loaded) return
  root.dataset.loaded = '1'
  const { locale = 'fr', base = '' } = root.dataset
  const list = root.querySelector<HTMLElement>('[data-upcoming-list]')
  const items = await fetchNext(locale, 3)
  if (!list || !items.length) return
  for (const it of items) {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.className = 'up-card'
    a.href = `${base}${it.slug}/`
    const date = document.createElement('time')
    date.dateTime = it.startsAt
    date.textContent = when(it, locale)
    const title = document.createElement('strong')
    title.textContent = it.title
    a.append(date, title)
    const place = [it.location, it.group].filter(Boolean).join(' · ')
    if (place) {
      const s = document.createElement('span')
      s.textContent = place
      a.append(s)
    }
    li.append(a)
    list.append(li)
  }
  root.hidden = false
}

/** Fills the Agenda menu's highlight the first time someone opens or reaches for it. */
export function wireNextEvent() {
  const slot = document.querySelector<HTMLAnchorElement>('[data-next-event]')
  const trigger = slot
    ?.closest('[data-menu-panel]')
    ?.parentElement?.querySelector<HTMLElement>('[data-menu-trigger]')
  if (!slot || !trigger || slot.dataset.wired) return
  slot.dataset.wired = '1'
  const fill = async () => {
    const [it] = await fetchNext(slot.dataset.locale ?? 'fr', 1)
    if (!it) return
    slot.href = `${slot.dataset.base ?? ''}${it.slug}/`
    const t = slot.querySelector('[data-next-title]')
    const w = slot.querySelector('[data-next-when]')
    if (t) t.textContent = it.title
    if (w) w.textContent = when(it, slot.dataset.locale ?? 'fr')
    slot.hidden = false
  }
  for (const ev of ['pointerenter', 'focus', 'click'] as const)
    trigger.addEventListener(ev, fill, { once: true })
}
