# STATUS

_Last updated: 2026-10-26. History lives in the phase reports (`docs/phases/PHASE_0N_REPORT.md`); this file is only the current state._

## Current phase: 05 — Release, then Mon espace & group life
Branch `feat/phase-05a-member-home` (from `main`). Brief: `docs/phases/PHASE_05_INSTRUCTIONS.md`. **Working on:** Checkpoint 0 (what Claude can do), then Checkpoint L
(legal footing), then the Mon espace plan (IA + sketch) — each stops for Joël's approval.
**Checkpoint A built on dev (2026-10-26):** Mon espace in five sections (Accueil, Inscriptions, Groupes, Notifications, Profil), my registrations with link-by-cancel-link, my groups (list, leave), member notifications and a header bell; migration 0037 (index). Plan: `docs/product/mon-espace.md`. **Checkpoint L (legal) is deferred at Joël's request:** the safer reading applies meanwhile.
Done on this branch so far: decision **0048** (system-role grants offered once through a ledger, migration 0036, dev only), the generated grants list
(`docs/ops/release-phase-04.md`), the privacy-policy draft v2 (`docs/legal/privacy-policy-draft-v2.md`), the device-pass sheet (`docs/ops/device-pass.md`),
the backup error message, the service-worker cache keep-list (+ test), the decisions index in order.

## Production
- **Phase 04 is live** (PR #6 merged 2026-10-25; the deploy workflow applied the migrations; `db:seed` and `bible:seed` ran). `SITE_INDEXABLE` is **not** set (noindex).
- **Not yet applied on production:** migration **0036** and the ledger seed (they ship with the Phase 05A merge). Before that merge: a Neon backup branch `pre-phase-05` and a working backup.
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

## Open questions
- Épiphanie / Pentecôte season end dates and colours (proposed, to confirm); is the Délivrance ministry presented publicly (council); the parish signature line (candidates in `/_brand` → Identité).
- Bible verses on the admin login (Parole de Vie / Easy-to-Read Version): check the wording and quotation terms.
- Google sign-in `invalid_client` locally means `GOOGLE_CLIENT_SECRET` in `.env.local` does not match the client.

## Carry-overs
- « Mes inscriptions » in Mon espace (planned in Phase 05 Checkpoint A); the per-event `.ics` on the registration confirmation page.
- **Tell the Bible service:** the parish's 2026 calendar has an error at **Hébreux 8, 19** (flagged by the import checks), and two psalm-column warnings (2026-09-16 and 09-17: « 1-22 » / « 23-43 » have no psalm number).
- The carte de Sainte-Cène (and what the card means) must be defined with the parish before it is built (Checkpoint C).

## History
Phase reports: `docs/phases/PHASE_01_REPORT.md` … `PHASE_04_REPORT.md`. Decisions: `docs/decisions/README.md`.
