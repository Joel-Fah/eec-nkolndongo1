/**
 * The Moissons entries (menu, footer) are hidden until the campaign is in season (decision 0042). Pages are static, so this asks the
 * edge-cached teaser (no amounts) and reveals the marked links. Without an answer they simply stay hidden.
 */
let pending: Promise<boolean> | null = null
const inSeason = () => {
  pending ??= fetch(
    `/api/campaigns/public/teaser?locale=${document.documentElement.lang === 'en' ? 'en' : 'fr'}`,
    { credentials: 'omit' },
  )
    .then((r) => (r.ok ? r.json() : null))
    .then(
      (j: { campaign?: { inSeason?: boolean } | null } | null) => j?.campaign?.inSeason === true,
    )
    .catch(() => false)
  return pending
}

export async function applySeasonLinks() {
  const links = document.querySelectorAll<HTMLElement>('[data-season-link]')
  if (!links.length || !(await inSeason())) return
  for (const el of links) el.setAttribute('data-on', '')
}
