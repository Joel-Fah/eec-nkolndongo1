import { shortDate } from '@eec/core/dates'

/**
 * Home « Dernières nouvelles »: the home page stays a static file (no render cost, instant). This small script
 * asks the edge-cached /api/news/public for the three newest posts and fills the hidden section; with no news,
 * or if the API is slow or down, the section simply stays hidden. Text is set with textContent only.
 */
type Cover = {
  variants: { key: string; width: number }[]
  altFr: string | null
  altEn: string | null
}
type Item = {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  cover: Cover | null
}

export async function showLatestNews() {
  const root = document.querySelector<HTMLElement>('[data-latest-news]')
  if (!root || root.dataset.loaded) return
  root.dataset.loaded = '1'
  const { locale = 'fr', base = '', more = '' } = root.dataset
  const list = root.querySelector<HTMLElement>('[data-latest-list]')
  if (!list) return
  try {
    const res = await fetch(`/api/news/public?locale=${locale}&limit=3`, { credentials: 'omit' })
    if (!res.ok) return
    const { items } = (await res.json()) as { items: Item[] }
    if (!items.length) return
    for (const it of items) {
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.className = 'ln-card'
      a.href = `${base}${it.slug}/`
      const v = it.cover ? [...it.cover.variants].sort((x, y) => x.width - y.width) : []
      if (it.cover && v.length) {
        const img = document.createElement('img')
        img.src = `/media/${(v[1] ?? v[0])?.key}`
        img.srcset = v.map((x) => `/media/${x.key} ${x.width}w`).join(', ')
        img.sizes = '(min-width: 64rem) 22rem, 90vw'
        img.alt = ''
        img.loading = 'lazy'
        img.decoding = 'async'
        const photo = document.createElement('span')
        photo.className = 'ln-photo'
        photo.append(img)
        a.append(photo)
      }
      const body = document.createElement('span')
      body.className = 'ln-body'
      const time = document.createElement('time')
      time.dateTime = it.publishedAt
      time.textContent = shortDate(it.publishedAt, locale)
      const h = document.createElement('strong')
      h.textContent = it.title
      body.append(time, h)
      if (it.excerpt) {
        const p = document.createElement('span')
        p.className = 'ln-excerpt'
        p.textContent = it.excerpt
        body.append(p)
      }
      a.append(body)
      li.append(a)
      list.append(li)
    }
    const all = root.querySelector<HTMLAnchorElement>('[data-latest-all]')
    if (all) {
      all.href = base
      all.textContent = more
    }
    root.hidden = false
  } catch {
    // stays hidden
  }
}
