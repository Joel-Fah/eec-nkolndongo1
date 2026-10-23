import { shortDate } from '@eec/core/dates'

/**
 * Home « Ce dimanche » card and verse of the day: the home page stays a static file; this script reads the
 * edge-cached public API. Nothing published, or the API slow/down: the card stays hidden and the built-in verse
 * stays. Text is set with textContent only.
 */
type Sunday = {
  holySupper?: boolean
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
      set('[data-sunday-date]', shortDate(`${s.date}T12:00:00Z`, locale, 'UTC'))
      set('[data-sunday-theme]', s.theme)
      // Tags: the season (unless Ordinary Time) and the Holy Supper.
      const seasonLabel =
        s.season === 'ordinaire' ? '' : (root.getAttribute(`data-season_${s.season}`) ?? '')
      set('[data-sunday-season]', seasonLabel)
      set('[data-sunday-tag]', s.holySupper ? (root.dataset.supper ?? '') : '')
      const tags = root.querySelector<HTMLElement>('[data-sunday-tags]')
      if (tags) tags.hidden = !seasonLabel && !s.holySupper
      // Readings: one chip each.
      const list = root.querySelector<HTMLElement>('[data-sunday-readings]')
      if (list) {
        list.replaceChildren(
          ...s.readings.map((r) => {
            const li = document.createElement('li')
            li.textContent = r.label
            return li
          }),
        )
      }
      const at = n?.next && n.next.startsAt.slice(0, 10) >= s.date ? n.next.startsAt : ''
      const clock = root.querySelector<HTMLElement>('[data-sunday-time]')
      if (clock) {
        const parts = at
          ? new Intl.DateTimeFormat('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
              timeZone: 'Africa/Douala',
            })
              .format(new Date(at))
              .split(':')
          : []
        clock.setAttribute('aria-label', parts.join(':'))
        clock.replaceChildren(
          ...parts.flatMap((v, i) => {
            const card = document.createElement('span')
            card.className = 'flip-card'
            card.setAttribute('aria-hidden', 'true')
            card.textContent = v
            if (i === 0) {
              const c = document.createElement('span')
              c.className = 'flip-colon'
              c.setAttribute('aria-hidden', 'true')
              c.textContent = ':'
              return [card, c]
            }
            return [card]
          }),
        )
      }
      const timeBlock = root.querySelector<HTMLElement>('[data-sunday-time-block]')
      if (timeBlock) timeBlock.hidden = !at
      const link = root.querySelector<HTMLAnchorElement>('[data-sunday-link]')
      if (link) link.href = base
      root.hidden = false
    }
  }
  if (verse && !verse.dataset.loaded) {
    verse.dataset.loaded = '1'
    const v = (await getJson<Verse>(`/api/liturgy/public/verse?locale=${locale}`))?.verse
    // Today's meditation verse, when it has one, wins over the general verse of the day.
    if (v && !verse.dataset.meditation) {
      const text = verse.querySelector<HTMLElement>('.bento-verse-text')
      const cite = verse.querySelector<HTMLElement>('.bento-verse-cite')
      if (text) text.textContent = v.text
      if (cite) cite.textContent = `${v.ref} · ${v.translation}`
    }
  }
}
