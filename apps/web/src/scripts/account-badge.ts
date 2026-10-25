/**
 * The account button in the header: when the visitor is signed in it shows their avatar (the generated abstract one, or their own
 * picture only if they chose to share it) and a small warning mark while their profile is incomplete (decision 0047). The page itself is
 * cached public HTML and knows nothing about the visitor, so this asks `/api/me/badge` (private, never cached) and keeps the answer
 * for a minute in this tab. Signed out: nothing changes. Mon espace clears the saved answer when the profile changes.
 */
import { avatarSvg } from '@eec/ui/avatar-art'

type Badge = {
  signedIn: boolean
  seed?: number
  incomplete?: boolean
  photo?: boolean
  photoV?: number
}
const KEY = 'eec-badge'
const TTL = 60_000

async function read(): Promise<Badge | null> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as {
      at: number
      b: Badge
    } | null
    if (saved && Date.now() - saved.at < TTL) return saved.b
  } catch {
    // storage blocked: just ask
  }
  try {
    const res = await fetch('/api/me/badge', { credentials: 'same-origin' })
    if (!res.ok) return null
    const b = (await res.json()) as Badge
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), b }))
    } catch {
      // ignore
    }
    return b
  } catch {
    return null
  }
}

export async function initAccountBadge() {
  const links = [...document.querySelectorAll<HTMLElement>('[data-account-link]')]
  if (!links.length) return
  const b = await read()
  if (!b?.signedIn) return
  for (const link of links) {
    if (link.dataset.badged) continue
    link.dataset.badged = '1'
    const icon = link.querySelector<HTMLElement>('[data-account-icon]')
    const identiconFallback = avatarSvg(b.seed ?? 0)
    if (icon) {
      const wrap = document.createElement('span')
      wrap.className = 'nav-avatar'
      wrap.setAttribute('aria-hidden', 'true')
      wrap.innerHTML = b.photo
        ? `<img src="${b.photo}" alt="" width="28" height="28" decoding="async" referrerpolicy="no-referrer">`
        : avatarSvg(b.seed ?? 0)
      wrap.querySelector('img')?.addEventListener('error', () => {
        wrap.innerHTML = identiconFallback
      })
      icon.replaceWith(wrap)
    }
    if (b.incomplete) {
      const dot = document.createElement('span')
      dot.className = 'acct-badge'
      dot.setAttribute('aria-hidden', 'true')
      dot.textContent = '!'
      link.append(dot)
      const label = link.dataset.incompleteLabel
      if (label) link.setAttribute('aria-label', label)
    }
  }
}

/** Mon espace calls this after any change, so the header is right on the next page. */
export const forgetBadge = () => {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
