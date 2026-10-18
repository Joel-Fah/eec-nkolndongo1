# Navigation

Max **5 top-level tabs**. Everything else nests in dropdowns. The logo links home.

| Tab (FR / EN) | Children |
|---|---|
| **Découvrir** / Discover | Notre histoire · Ce que nous croyons · Pasteurs & Conseil · Nous trouver |
| **Vivre** / Live | Cultes & horaires · Départements · Vie pratique (baptême, mariage, deuil, adhésion) |
| **Agenda** / Calendar | Événements · Année liturgique · Fête des Moissons (seasonal) |
| **Actualités** / News | Nouvelles · Prédications · Méditations & bulletin |
| **Donner** / Give | (direct page) |

Right side utilities: Search · FR/EN · Theme · **Mon espace** (member login).
Footer: Contact, hours, address, socials (WhatsApp, Facebook, YouTube), legal links.

## Behaviour
- Desktop: dropdown "mega-panel" per tab with a short description per link + one small illustration or
  highlight (e.g. next event). Opens on hover-intent (≈120 ms) and on click/Enter; Esc closes.
- Mobile: full-screen sheet, tabs as accordions, utilities at the bottom; animated with a soft
  clip-path reveal. Thumb-reachable close button.
- Header hides on scroll down, reappears on scroll up; turns translucent (backdrop blur) over heroes.
- Active section is indicated subtly (underline stroke, not a heavy fill).

## URL scheme
`/fr/...` (default, `/` redirects by `Accept-Language`, falling back to FR) and `/en/...`.
Slugs are localised: `/fr/decouvrir/notre-histoire` ↔ `/en/discover/our-story`.

## Admin navigation
Sidebar generated from module manifests, grouped: Contenu · Vie paroissiale · Membres · Finances ·
Paramètres. Items hidden when the user lacks permission. Command palette (⌘K / Ctrl+K) for quick actions.
