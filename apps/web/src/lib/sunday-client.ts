/**
 * Home « Ce dimanche » card and verse of the day: the home page stays a static file; this script reads the
 * edge-cached public API. Nothing published, or the API slow/down: the card stays hidden and the built-in verse
 * stays. Text is set with textContent only.
 */
type Sunday = {
  date: string
  season: string
  name: string
  theme: string
  readings: { label: string }[]
  published: boolean
}
type Next = { next: { startsAt: string; kind: string } | null }
type Verse = { verse: { ref: string; text: string; translation: string } | null }

const getJson = async <T>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { credentials: 'omit' })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

export async function showSunday() {
  const root = document.querySelector<HTMLElement>('[data-sunday]')
  const verse = document.querySelector<HTMLElement>('[data-verse-of-day]')
  const { locale = 'fr', base = '' } = root?.dataset ?? verse?.dataset ?? {}
  if (root && !root.dataset.loaded) {
    root.dataset.loaded = '1'
    const [s, n] = await Promise.all([
      getJson<Sunday>(`/api/liturgy/public/sunday?locale=${locale}`),
      getJson<Next>('/api/schedule/public/next'),
    ])
    if (s?.published) {
      root.setAttribute('data-season', s.season)
      const set = (sel: string, v: string) => {
        const el = root.querySelector<HTMLElement>(sel)
        if (el) {
          el.textContent = v
          el.hidden = !v
        }
      }
      set('[data-sunday-name]', s.name)
      set(
        '[data-sunday-date]',
        new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
          new Date(`${s.date}T00:00:00Z`),
        ),
      )
      set('[data-sunday-theme]', s.theme)
      set('[data-sunday-readings]', s.readings.map((r) => r.label).join(' · '))
      const at = n?.next && n.next.startsAt.slice(0, 10) >= s.date ? n.next.startsAt : ''
      set(
        '[data-sunday-time]',
        at
          ? new Intl.DateTimeFormat(locale, {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Douala',
            }).format(new Date(at))
          : '',
      )
      const link = root.querySelector<HTMLAnchorElement>('[data-sunday-link]')
      if (link) link.href = base
      root.hidden = false
    }
  }
  if (verse && !verse.dataset.loaded) {
    verse.dataset.loaded = '1'
    const v = (await getJson<Verse>(`/api/liturgy/public/verse?locale=${locale}`))?.verse
    if (v) {
      const text = verse.querySelector<HTMLElement>('.bento-verse-text')
      const cite = verse.querySelector<HTMLElement>('.bento-verse-cite')
      if (text) text.textContent = v.text
      if (cite) cite.textContent = `${v.ref} · ${v.translation}`
    }
  }
}
