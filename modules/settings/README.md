# Module `settings` — Paramètres

**Purpose.** The parish's own details (names, address, PO box, phones, email, WhatsApp, social links, map
coordinates), the liturgical-season settings (Fête des Moissons dates, a manual override with an expiry) and
the screen for feature flags and system information. Always on (not toggleable).

**Data kept.** Table `settings`: one row per section (`parish`, `season`), each field `{ value, validated }`.
No personal data about individuals: these are the parish's public contact details. Seeds are research-draft
candidates, all **unvalidated** (`docs/content/README.md`); nothing invented.

**Public exposure.** Only approved values (`validated: true`) leave the API, through `/api/settings/public`
(edge-cached, decision 0021). Editing a value without `settings:validate` removes its approval.

**Rights.** `settings:read`, `settings:edit`, `settings:validate` (sensitive), `settings:flags` (sensitive).

**Retention.** Kept while relevant; every change is in the audit log (24 months).

**Owners.** Secrétariat (edits), super admin (approval, flags).
