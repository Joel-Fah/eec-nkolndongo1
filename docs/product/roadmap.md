# Roadmap & features

Each item becomes a module (`modules/<id>`). Phases are indicative; order inside a phase is flexible.

## Phase 0 — Foundations
- Brand board (logo SVG + lockups, palette, type, radius, sample illustration)
- Monorepo scaffold, design tokens, UI primitives (both themes, both locales)
- Auth (Neon Auth) + roles / groups / permissions + audit log
- Settings module (parish info, hours, socials, feature flags)
- Media library (R2 upload, image variants)

## Phase 1 — Launch
| Module | Public | Admin |
|---|---|---|
| `pages` | Story pages: Accueil, Notre histoire, Ce que nous croyons, Pasteurs & Conseil | Edit blocks of text/images on story pages |
| `news` | Actualités feed, article pages, share to WhatsApp | Write, schedule, publish, categories |
| `events` | Agenda, event pages, add-to-calendar (.ics) | Create, recurring events, per-department scope |
| `liturgy` | Année liturgique dial, season theming, "Ce dimanche" card, verse of the day | Set Sunday readings/theme/liturgist |
| `schedule` | Cultes & horaires, office hours | Edit times, exceptions (holidays) |
| `departments` | Department pages + "Où est ta place ?" quiz | Leaders manage their own page |
| `guides` | Vie pratique flows (baptême, mariage, deuil, adhésion) | Edit steps, documents, contacts |
| `contact` | Contact form, illustrated map → real map on tap | Inbox, assign, status |
| `giving` | Donner page: MoMo/OM numbers, bank details, purpose | Edit details |
| `members` | Sign up / log in, Mon espace (profile, consent) | Member list, headcount stats, export |
| `legal` | Privacy policy, mentions légales, consent | Edit texts, data-request log |

## Phase 2 — Grow
- `sermons`: archive (audio on R2, video on YouTube), series/speaker/book filters, podcast RSS
- `bulletin`: weekly bulletin & meditation programme (web + PDF)
- `registrations`: forms for events (retreats, concerts, catechism)
- `newsletter`: Brevo lists, email templates (needs domain)
- `campaigns`: Fête des Moissons page with goal tracker (harvest basket)
- PWA: installable, offline reading

## Phase 3 — Deepen
- `payments`: pawaPay (MTN MoMo + Orange Money), receipts, treasurer reconciliation
- Member services: carte de Sainte-Cène, attendance, group memberships
- Department spaces (leaders' tools)
- `requests`: sacrament requests (only after a data-protection decision record)
- Privacy-friendly analytics dashboard
- Phone/SMS or WhatsApp login (paid per message — evaluate)
