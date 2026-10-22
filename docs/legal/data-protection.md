# Data protection — Loi n°2024/017 du 23 décembre 2024 (Cameroun)

> Not legal advice. Have the final texts reviewed by someone competent before launch.
> The compliance grace period ended in June 2026 → we comply **from day one**.

## Principles we implement
| Obligation | Implementation |
|---|---|
| Lawfulness & explicit consent | Unticked consent checkboxes on every form; consent stored with timestamp + policy version |
| Minimisation | Each module's README lists the fields it stores and why; no optional field without a purpose |
| Retention & destruction | Retention per data type (table below); scheduled job deletes/anonymises expired data |
| Security & confidentiality | TLS everywhere, least-privilege roles, audit log, secrets in Cloudflare, Neon access restricted |
| Data subject rights | "Mon espace": view, edit, export (JSON), delete account; admin log of requests |
| Breach notification | Incident procedure in `docs/ops/` (notify APDP + affected people) |
| Non-discrimination | No collection of ethnic origin, region, political opinion |
| DPO | Council to designate a contact person for data questions |

## Initial retention proposals (to validate)
| Data | Retention |
|---|---|
| Contact form messages | 12 months after closure |
| Member account | While active; deleted 30 days after deletion request |
| Event registrations | 6 months after the event |
| Newsletter subscription | Until unsubscribe |
| Audit log | 24 months |
| Server logs | 30 days |

## Implemented in Phase 02 (2026-10)
- Consents stored per person with the policy version, the optional one withdrawable (Mon espace); the privacy page
  (FR/EN draft, `[À VALIDER]`) lists what is kept, why, who sees it, for how long and the rights.
- Mon espace: edit profile, view and withdraw consents, **download my data (JSON)**, **delete my account** (30-day
  grace, then purged by the daily retention job, which logs every run), sessions.
- Retention job (`apps/api/src/retention.ts`): sessions/links, outbox 90 days, audit 24 months, accounts past grace.
- Admin: member list and CSV export need `members:read` / `members:export`; the export is audited and defuses
  spreadsheet formulas. Dashboard numbers are aggregates.
- Media: photos have EXIF/GPS removed in the browser before upload; a photo of people needs the person's consent.
- Backups are encrypted (age); the private key is offline (decision 0022).

## Added in Phase 03a (2026-10)
- **Preacher and liturgist names** (module `liturgy`, per Sunday): display names typed by staff. They are public only
  when the « names consent » box is ticked, which records **who confirmed it and when**; unticking clears it. Names are
  never copied by « reprendre la semaine précédente » (consent was for one Sunday). Without consent they stay in the admin.
- **News, events, schedule, verses**: no personal data about parishioners. Staff names are kept only as `created_by` /
  `updated_by` (internal, audit log), never shown publicly.
- **Preview links** (news, events): signed, expiring after 3 days, `noindex`, no personal data in the link.
- Group leaders are scoped: a group-scoped role can edit only its own group's news and events.

## Added in Phase 03b (2026-10)
- **Contact messages** (module `contact`): name, email **or** phone, category, message, optional subject, status, assignee,
  internal notes, and the moment the visitor ticked the consent box (never pre-ticked). **No IP address is stored**: a
  salted hash is used only as a rate-limit key that expires within a day. Retention: 12 months after « handled » (at most 24
  after receipt).
- **Prayer requests** (category « Prière »): flagged sensitive, readable only with `contact:read-sensitive`, never exported,
  3 months after « handled » (at most 6 after receipt). Stated in the privacy policy.
- **People on department and council pages**: name, role, optional photo and term; **public only with a recorded consent**
  (who, when); withdrawal removes them at the next cache refresh (decision 0031).
- **Search**: queries are not stored and carry no user id; a hashed-address counter limits abuse for a day.
- **Guides**: the visitor's ticks stay in their own browser (`localStorage`); nothing is sent.
- **Quiz « Où est ta place ? »**: runs in the browser; nothing is sent or stored.
- **Legal documents**: every published version is kept (the record of what people agreed to); members are informed of a
  change and asked to accept again only when the purposes changed (decision 0033).
- **Giving**: no payment integration, no amounts, no donor data; only the parish's approved merchant details are shown.

## Added in Phase 04a (2026-10)
- **Visit counts** (decision 0038, **dormant until Joël enables it**): one data point per page view served by the Worker:
  day, page address, language, phone/desktop. **No cookie, no IP address, no user agent stored, no identifier**; two visits by
  one person cannot be linked. Skipped when the browser sends « do not track ». Kept 3 months at Cloudflare, shown to staff as
  aggregates. If Analytics Engine is not available on the free plan, nothing is counted and no other analytics is used.
- **Health check**: the daily check stores technical measures only (response time, storage used, backup age, outbox count),
  no personal data. Kept 90 days.
- **Content reviews** (« À valider », decision 0040): comments between staff about a text or figure, linked to the item, no
  visitor data. The audit log records that a correction was asked, never its text.
- **Contact form**: the minimum fill time now relies on a token signed by the server when the form is shown (it carries
  only the time and a signature, no identifier), instead of a time sent by the browser.

## Explicitly out of scope until a decision record exists
Baptism/marriage registers, counselling/délivrance notes, health information, minors' data beyond
what a parent provides for a specific activity.

## Pages to ship
- Politique de confidentialité (draft in `docs/research/`, to rewrite)
- Mentions légales
- Cookie notice: none needed if we use no tracking cookies (only essential session cookies) — keep it that way.
