# Roadmap & features

Each item becomes a module (`modules/<id>`). Phases are indicative; order inside a phase is flexible.

## Phase 0 — Foundations
- Brand board (logo SVG + lockups, palette, type, radius, sample illustration)
- Monorepo scaffold, design tokens, UI primitives (both themes, both locales)
- Auth (Neon Auth) + roles / groups / permissions + audit log
- Settings module (parish info, hours, socials, feature flags)
- Media library (R2 upload, image variants)

## Phase 1 — Launch  _(built in Phases 02–03; launch = Joël's call once content is validated)_
| Module | Public | Admin |
|---|---|---|
| `story` ✅ | Notre histoire (Gravir la colline), Ce que nous croyons, Pasteurs & Conseil | Content slots, history milestones, council with consent |
| `news` ✅ | Actualités feed, article pages, share to WhatsApp | Write, schedule, publish, categories |
| `events` ✅ | Agenda, event pages, add-to-calendar (.ics) | Create, recurring events, per-department scope |
| `liturgy` ✅ | Année liturgique dial, season theming, "Ce dimanche" card, verse of the day | Set Sunday readings/theme/liturgist |
| `schedule` ✅ | Cultes & horaires, office hours | Edit times, exceptions (holidays) |
| `departments` ✅ | Department pages + "Où est ta place ?" quiz | Leaders manage their own page |
| `guides` ✅ | Vie pratique flows (baptême, mariage, deuil, adhésion) | Edit steps, documents, contacts |
| `contact` ✅ | Contact form, illustrated map → real map on tap | Inbox, assign, status |
| `giving` ✅ (settings section « Donner ») | Donner page: MoMo/OM numbers, bank details, purposes | Edit and approve each value |
| `members` ✅ | Sign up / log in, Mon espace (profile, consent) | Member list, headcount stats, export |
| `legal` ✅ | Privacy policy, mentions légales, consent | Edit texts, data-request log |

## Phase 2 — Grow
- `sermons` ✅ (links only, decision 0034): series, preacher with consent, passages, YouTube facade, any https links; podcast RSS parked until a host with direct file URLs exists
- `bulletin` ✅ and `meditations` ✅: weekly bulletin (assembled from the site's own data, print layouts) and the meditation programme (CSV import)
- `registrations` ✅: forms for events, waitlist, check-in, retention
- `newsletter`: Brevo lists, email templates (needs domain)
- `campaigns` ✅: Fête des Moissons (members' page in season, validated totals only)
- `sundays` ✅ (added): Sunday and special-day reports, proposed figures validated by the secretariat and the treasurer, trends
- In-app notifications ✅ (added): reminders, validators' queue, weekly summary, per-person mutes
- PWA ✅: installable, offline reading of saved public pages
- Member profile ✅ (added): optional details behind a consent, private photo, generated avatar, completion warnings

## Phase 3 — Deepen
- `payments`: pawaPay (MTN MoMo + Orange Money), receipts, treasurer reconciliation
- Member services: **carte de Sainte-Cène** (the member card was removed from Mon espace for now, decision 0047: one card, planned properly here together with the rest of « Mon espace »), attendance, group memberships
- Department spaces (leaders' tools)
- `requests`: sacrament requests (only after a data-protection decision record)
- Privacy-friendly analytics dashboard
- Phone/SMS or WhatsApp login (paid per message — evaluate)
