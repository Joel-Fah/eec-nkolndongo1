import { shortDate } from '@eec/core/dates'

/**
 * Home « Dernière prédication »: the home page stays a static file; this script asks the edge-cached sermons list for the
 * newest one and fills the hidden section. No sermon, or the API slow or down: the section stays hidden. Text only
 * (textContent); nothing is loaded from YouTube or any link.
 */
type Item = {
  slug: string
  title: string
  summary: string
  preachedOn: string | null
  series: { title: string } | null
  refs: { label: string }[]
}

export async function showLatestSermon() {
  const root = document.querySelector<HTMLElement>('[data-latest-sermon]')
  if (!root || root.dataset.loaded) return
  root.dataset.loaded = '1'
  const { locale = 'fr', base = '', more = '' } = root.dataset
  const card = root.querySelector<HTMLAnchorElement>('[data-latest-sermon-card]')
  if (!card) return
  try {
    const res = await fetch(`/api/sermons/public?locale=${locale}&limit=1`, { credentials: 'omit' })
    if (!res.ok) return
    const { items } = (await res.json()) as { items: Item[] }
    const it = items[0]
    if (!it) return
    card.href = `${base}${it.slug}/`
    const set = (sel: string, text: string) => {
      const el = card.querySelector<HTMLElement>(sel)
      if (el) {
        el.textContent = text
        el.hidden = !text
      }
    }
    set('[data-s-date]', it.preachedOn ? shortDate(`${it.preachedOn}T12:00:00Z`, locale) : '')
    set('[data-s-series]', it.series?.title ?? '')
    set('[data-s-title]', it.title)
    set('[data-s-refs]', it.refs.map((r) => r.label).join(' · '))
    set('[data-s-sum]', it.summary)
    const all = root.querySelector<HTMLAnchorElement>('[data-latest-sermon-all]')
    if (all) {
      all.href = base
      all.textContent = more
    }
    root.hidden = false
  } catch {
    // stays hidden
  }
}
