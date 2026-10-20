/**
 * Parish settings on the public site (decision 0021). Pages are static: they never wait for the database.
 * This tiny script asks the edge-cached /api/settings/public (approved values only) and fills the marked
 * places — footer address, social links — and applies a season override or the Fête des Moissons dates.
 * If the API is slow or down, the page simply keeps its built-in defaults.
 */
import { getSeason, type Season } from '@eec/core'

type PublicSettings = { parish?: Record<string, string>; season?: Record<string, string> }

let pending: Promise<PublicSettings | null> | null = null
const load = () => {
  pending ??= fetch('/api/settings/public', { credentials: 'omit' })
    .then((r) => (r.ok ? (r.json() as Promise<PublicSettings>) : null))
    .catch(() => null)
  return pending
}

const get = (s: PublicSettings, path: string) => {
  const [section, key] = path.split('.') as ['parish' | 'season', string]
  return s[section]?.[key]
}

export async function applyPublicSettings() {
  const s = await load()
  if (!s) return
  for (const el of document.querySelectorAll<HTMLElement>('[data-setting]')) {
    const value = get(s, el.dataset.setting ?? '')
    if (!value) continue
    const target = el.querySelector<HTMLElement>('[data-setting-text]') ?? el
    target.textContent = value
    el.hidden = false
  }
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-setting-link]')) {
    let value = get(s, a.dataset.settingLink ?? '')
    if (!value) continue
    // WhatsApp: a number becomes a wa.me link; a channel link is used as is.
    if (a.dataset.settingLink === 'parish.whatsapp' && !value.startsWith('https://'))
      value = `https://wa.me/${value.replace(/[^\d]/g, '')}`
    if (!value.startsWith('https://')) continue
    a.href = value
    const name = a.dataset.labelReady ?? ''
    a.title = name
    a.setAttribute('aria-label', name)
  }
  const season = s.season ?? {}
  if (season.override || (season.moissonsStart && season.moissonsEnd)) {
    const iso = new Date().toISOString().slice(0, 10)
    const override =
      season.override && (!season.overrideUntil || season.overrideUntil >= iso)
        ? season.override
        : null
    const next = getSeason(new Date(), {
      override: override as Season | null,
      harvest:
        season.moissonsStart && season.moissonsEnd
          ? { from: season.moissonsStart, to: season.moissonsEnd }
          : null,
    })
    document.documentElement.dataset.season = next
  }
}
