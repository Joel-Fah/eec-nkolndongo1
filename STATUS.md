# STATUS

_Last updated: 2026-10-27. History lives in the phase reports (`docs/phases/PHASE_0N_REPORT.md`); this file is only the current state._

## Current phase: 05 — built on dev, waiting for review and the merge
Branch `feat/phase-05a-member-home` (PR open, **not merged**). Report: `docs/phases/PHASE_05_REPORT.md`. Built: Mon espace as the member's home, groups with join requests, « Mon groupe », announcements, the carte de Sainte-Cène
(cards, visas, contributions register, QR check, offline copy), the data-rights log. Push: « not now » (0051). Checkpoint L (legal footing) done as far as the sources allow: the official text could not be retrieved, so the notes mark every point « certain » or « à confirmer » (`docs/legal/member-data-legal-notes.md`, `questions-pour-un-juriste.md`, `register.md`). Migrations 0035–0040 are on the dev branch only.

**Since the PR was opened (local commit, not pushed):** Google for staff (0053). A staff member adds Google from Mon compte (password asked again) and then signs in with it from the admin page; a link made by an e-mail match is refused; a member who signed up with Google and later got a role keeps the link they made. No migration, no new secret. Needs `GOOGLE_CLIENT_ID/SECRET` on the environment (same as members). To try on dev: sign in as a staff account, Mon compte → Connexion avec Google.

## Production
- **Phase 04 is live** (PR #6 merged 2026-10-25; the deploy workflow applied the migrations; `db:seed` and `bible:seed` ran). `SITE_INDEXABLE` is **not** set (noindex).
- **Not yet applied on production:** migrations **0036–0040** and the seed (they ship with the Phase 05 merge). Before that merge: a Neon backup branch `pre-phase-05` and a working backup.
- Backup: a manual encrypted backup was taken before the release (`eec-20261025-1831`). The weekly `backup` workflow **fails (403 on upload)** until the GitHub
  environment secrets (`AWS_*`, environment `production`) match `.env.production.local` (`gh secret set … --env production` from the prod shell).

## Waiting on Joël (production and people)
1. Role grants in Rôles for Phase 04 (or wait for 0048 in production) — `docs/ops/release-phase-04.md`; and which role should hold the permissions no system role has.
2. Publish the new privacy-policy version (`docs/legal/privacy-policy-draft-v2.md`, « changement de finalité » ticked) after the Conseil validates it; confirm the Neon region.
3. Fix the backup workflow secrets and run it once.
4. **The device pass** on a real Android phone (and an iPhone): `docs/ops/device-pass.md` (never done since Phase 01).
5. Content validation partner: service times, history, council members, department list, address, socials. Real parish photos with consent. MoMo / Orange Money merchant
   details and the bank account (Donner). Real figures for the home (`apps/web/src/lib/stats.ts`). The Conseil's review of the brand-voice text.
6. Domain: **on hold**, do not register.
7. **Phase 05 on production (after review):** Neon backup branch `pre-phase-05` + a working backup; merge (the deploy migrates); `pnpm db:seed` in the prod shell; grant « Ancien d'Église » to the Elders and « Responsable de groupe » (with the group) to leaders; enter `https://www.youtube.com/@BCN-MEDIA` in Réglages (`parish.youtube`); publish the privacy text (now covering groups, cards, baptism declaration) after the Conseil reads it; the device pass incl. the card offline and the QR scanner; Send `docs/legal/questions-pour-un-juriste.md` to a lawyer and get the official text.

## Open questions
- Épiphanie / Pentecôte season end dates and colours (proposed, to confirm); is the Délivrance ministry presented publicly (council); the parish signature line (candidates in `/_brand` → Identité).
- Bible verses on the admin login (Parole de Vie / Easy-to-Read Version): check the wording and quotation terms.
- Google sign-in `invalid_client` locally means `GOOGLE_CLIENT_SECRET` in `.env.local` does not match the client.

## Carry-overs
- **Tell the Bible service:** the parish's 2026 calendar has an error at **Hébreux 8, 19** (flagged by the import checks), and two psalm-column warnings (2026-09-16 and 09-17: « 1-22 » / « 23-43 » have no psalm number).
- The carte de Sainte-Cène is built (0050); the preparation-week dates are the default (Monday–Saturday before the second Sunday), not editable per month yet.

## History
Phase reports: `docs/phases/PHASE_01_REPORT.md` … `PHASE_04_REPORT.md`. Decisions: `docs/decisions/README.md`.
