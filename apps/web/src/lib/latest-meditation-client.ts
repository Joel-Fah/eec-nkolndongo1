/**
 * Home « Méditation du jour »: the home page stays a static file; this script asks the edge-cached meditations API for today's
 * readings and fills the hidden card. If today's meditation has a verse (typed in LSG 1910 / WEB), it also replaces the general
 * verse of the day (which stays as the fallback). No programme for today, or the API slow or down: nothing changes.
 */
type Day = {
  date: string
  headline: string
  readings: { label: string; ref: string }[]
  psalm: string
  verse: { ref: string; text: string; translation: string } | null
}

export async function showMeditation() {
  const root = document.querySelector<HTMLElement>('[data-meditation-today]')
  const verse = document.querySelector<HTMLElement>('[data-verse-of-day]')
  if (!root || root.dataset.loaded) return
  root.dataset.loaded = '1'
  const { locale = 'fr', base = '' } = root.dataset
  try {
    const res = await fetch(`/api/meditations/public/day?locale=${locale}`, { credentials: 'omit' })
    if (!res.ok) return
    const { day } = (await res.json()) as { day: Day | null }
    if (!day) return
    const card = root.querySelector<HTMLAnchorElement>('[data-med-card]')
    const list = root.querySelector<HTMLElement>('[data-med-list]')
    if (!card || !list) return
    card.href = base
    const head = root.querySelector<HTMLElement>('[data-med-headline]')
    if (head) {
      head.textContent = day.headline
      head.hidden = !day.headline
    }
    const date = root.querySelector<HTMLElement>('[data-med-date]')
    if (date) {
      const s = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${day.date}T12:00:00Z`))
      date.textContent = s.charAt(0).toUpperCase() + s.slice(1)
    }
    const items = [...day.readings.map((r) => r.ref), ...(day.psalm ? [day.psalm] : [])]
    for (const text of items) {
      const li = document.createElement('li')
      li.textContent = text
      list.append(li)
    }
    root.hidden = false
    if (day.verse && verse) {
      const text = verse.querySelector<HTMLElement>('.bento-verse-text')
      const cite = verse.querySelector<HTMLElement>('.bento-verse-cite')
      if (text && cite) {
        text.textContent = day.verse.text
        cite.textContent = `${day.verse.ref} · ${day.verse.translation}`
        verse.dataset.meditation = '1'
      }
    }
  } catch {
    // stays hidden
  }
}
