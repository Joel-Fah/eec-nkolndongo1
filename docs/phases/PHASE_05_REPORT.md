# Phase 05 — report: Mon espace, groups, the Communion card, data requests

_Branch `feat/phase-05a-member-home` (all of Phase 05 after the release). Dev only: nothing here is on production._

## 1. Release record (Checkpoint 0)
Phase 04 was released on 2026-10-25 (PR #6; the deploy applied migrations 0019–0035; `db:seed` and `bible:seed` ran). Left to Joël: role grants (or decision 0048 on production), publishing the new privacy text, the backup workflow secrets (403 on upload), and the **device pass** (`docs/ops/device-pass.md`, never done). Before the next merge: a Neon backup branch `pre-phase-05` and a working backup.

## 2. Device-pass table
Not done (needs a real Android phone and an iPhone). The sheet and the post-release smoke test are ready: `docs/ops/device-pass.md`. New rows to add for Phase 05: Mon espace on a 360 px phone, the card offline (airplane mode), the QR scanned by another phone, the admin scanner on a phone.

## 3. Legal notes status
Checkpoint L was done afterwards, within what could be reached: the **official text of Loi n°2024/017 could not be retrieved** (only secondary summaries, which disagree on the declaration regime and the DPO, and give no deadline for data-subject requests), so `member-data-legal-notes.md` marks each point « certain » or « à confirmer ». The six missing module READMEs were written and `pnpm --filter @eec/scripts legal:register` builds the module table of `register.md`; `questions-pour-un-juriste.md` lists ten questions. Also: decisions 0049, 0050, 0052; `docs/legal/register.md` (Phase 05 rows only); `data-protection.md` updated; privacy policy draft v2 extended (groups, cards, baptism declaration). The deadlines and retention durations marked « à confirmer » wait for the legal text.

## 4. What was built
- **Decision 0048:** system-role grants offered once (ledger); the seed now also creates roles (**Ancien d'Église**).
- **Mon espace** (A): full width, welcome band with slow waves and a polaroid photo, side menu and phone bar, bento home, five sections (Accueil, Inscriptions with « relier » by the signed cancel link, Groupes, Notifications with per-kind mutes, Profil); sections warmed after the first paint; the unread count is a red badge on the avatar (no bell).
- **Groups** (B, 0049): join requests (a person waiting is not a member), « Mon groupe » in the admin (roster, requests, removal with a reason, figures, audited export; phone only if shared per group), module `announcements`, member notifications, « vous êtes membre » on the public group page.
- **Communion card** (C, 0050): module `communion`; two-person issue; Elders' monthly visa and contributions register; fees (expected only, never a debt); member-declared excuse; streak; reminder in the preparation week; signed QR and the public check page; admin scanner; offline copy; baptism declaration with an explicit acknowledgement; roles, help guide.
- **D:** data-rights log (0052, module `rights`, overdue notification, retention); **push decided « not now »** (0051).
- Admin help for every new screen lives in the top-bar sheet (guides: cartes-sainte-cene, mon-groupe, annonces-groupe, demandes-donnees).
- Migrations 0035 (photo as avatar), 0036 (grant ledger), 0037 (registrations index), 0038 (group requests, share_phone, announcements), 0039 (Communion), 0040 (rights). All additive.

## 5. Measurements
- `pnpm check`: 106/106 tasks. `pnpm e2e`: blocks 1–13 (groups block 12, card block 13) pass when the dev database is reachable.
- Mon espace JavaScript (gzip): page island 7.0 KB, section chunks 7.0 KB in total (home 1.7, card 1.6, groups 1.4, registrations 1.2, notifications 1.1), **`pickers` 35.6 KB** (loaded by the profile; the heaviest piece), header/footer ≈ 9 KB: about **60 KB**, under the 100 KB budget. The public pages are unchanged. Suggestion: load the date picker only when the profile form opens.
- The dev database is remote: each API call takes about 4 s there, which is the dev network, not the code.
- Verify endpoint and send CPU on the Free plan were **not measured** (push was not built; the verify route does two small reads and one HMAC).

## 6. Deviations from the brief
- Join requests are a **separate table**, not new columns on `group_members` (0049): safer, nothing existing can count a waiting person.
- Phone sharing is a per-group choice by the member, not read from the profile consent.
- Retention of card data is « with the account » (not 12 months after leaving).
- The Mon espace shell is kept by the service worker (0037 amended) so the card opens offline.
- The brief's `groups:export` is `core:group-export`.
- The staff bell in the admin stays; only the public header lost its bell.

## 7. Known issues and open points
- The legal footing rests on secondary sources: a lawyer must read the official text; deadlines and retention are « à confirmer ».
- Preparation-week dates are not editable per month (the default Monday–Saturday applies).
- The device pass, airplane-mode card test and phone scanner test are Joël's.
- `pickers` JavaScript weight in Mon espace (above).
- The e2e script retries 5xx answers because the dev database is remote and sometimes unreachable.
- Staff accounts are never purged by the retention job (unchanged).

## 8. Suggestions for Phase 06
Newsletter once a domain exists; pawaPay once merchant details exist; an audio host if podcasts are wanted; sacrament requests after a legal answer; push (0051) once devices and CPU cost are measured; department tools beyond rosters and announcements; the legal footing (Checkpoint L) with a lawyer.
