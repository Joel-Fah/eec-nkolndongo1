# Phase 04 — Go-live & Grow: report (in progress)

_Updated 2026-10-22, at Checkpoint A (04a)._

## Where the instructions and the code disagreed
| Instruction assumed | Reality | What was done |
|---|---|---|
| Production two phases behind; catch-up with Joël present | Both Phase 03 PRs were merged and `deploy` shipped them, migrations 0006–0018 included, with no backup branch and no seed | Checkpoint 0 production steps reduced to: audit, post-hoc backup branch, seed, role grants (not done yet, see below) |
| JSON-LD and OG tags exist, only to be checked | **Neither existed**; the static sitemap listed only the few prerendered pages | Built: share cards, JSON-LD, an on-demand sitemap (the `@astrojs/sitemap` integration removed) |
| Validation: « comment » on the existing flags | No review thread existed | `content_reviews` table + « À valider » (decision 0040) |
| Help section, markdown, print CSS | None existed | Small escaped renderer (no dependency), 11 guides + 4 cheat sheets, print CSS |
| Home texts in `lib/stats.ts` | Also in messages; the page is static | Slots + tiny client script (decision 0039) |
| Visit counts if Analytics Engine is on Free | Cannot be confirmed from the Worker; a binding to a service not enabled fails the deploy | Code shipped dormant; switched on by Joël (decision 0038, runbook) |
| `pg_trgm` as a Phase 04 suggestion | Already migration 0018 | Nothing to do |

## Checkpoint 0 — done on dev; production and device work deferred by Joël
- ✅ Signed fill-time token for the contact form (HMAC with `AUTH_SECRET`, reuses `signPreview`), tested; the e2e covers a forged token.
- ✅ Automated test for the prayer-request rule (`contact:read-sensitive`) at route level.
- ✅ Safe preview: a separate `eec-nkolndongo1-preview` Worker (own secrets pointing at dev data), `PREVIEW_WORKER=1`.
- ⏳ **Not done (needs Joël / a real phone / production):** production audit, post-hoc backup branch, seed + role grants,
  Worker CPU from Cloudflare metrics, LCP/CLS on a real Android phone (incl. the preloader's cost), Neon egress, TalkBack,
  keyboard audit, tap-to-dial, `geo:`, `.ics` in Google Calendar and iOS, R2 and launch-address answers.
- Lab reading only (local workerd, 4× CPU, slow 4G, warm): LCP 2.2–2.7 s on the content pages (the preloader holds the page ~2.5 s
  on a first visit, so it is the likely floor: **to be measured on the phone before any change**); `/fr/vivre/cultes-et-horaires/`
  8.1 s was a cold database; CLS 0.000; third-party requests 0.

## Checkpoint A — built (dev)
Weights (production build, lab profile): JS 15–16.4 KB gz, first load 158–209 KB; the home page now also asks the cached
`/api/story/public` for its slots (decision 0039). Admin initial JS unchanged (help, validate, health, visits are lazy chunks of
0.6–1.6 KB each; the markdown renderer is 1.3 KB). Share cards ≈ 36–55 KB each (12 files).
- **Home slots** (0039): `lead`, `invite_title`, `invite_text`, four number slots, hidden until published.
- **Validation** (0040): role « Validateur de contenu », permissions `core:validation-read|comment`, screen « À valider », comments.
- **Aide**: 11 guides, 4 cheat sheets (print), « ? » in the top bar; guides written from the real screens and wording.
- **Santé**: `system_health`, `system_marks`; checks: database time, bucket, last backup, outbox, database size, files size.
- **Visit counts** (0038): recorder + admin section, dormant; `deploy.json` + dashboard steps in the runbook.
- **Search/social readiness**: `og:*`/`twitter:*` tags, default cards (`apps/web/public/og`), JSON-LD, `/sitemap.xml`, `scripts/jsonld-check.ts`
  (all good locally). The **Rich Results Test on production URLs** is still to run (needs a public URL).
- **Docs**: `docs/ops/launch.md`, runbook, data-protection, decisions 0038–0040, `/_brand` entries.

## Known issues / open
- Production permissions: after the next deploy, `pnpm db:seed` and the role grants (new: `core:validation-*`, `core:system-health`,
  `core:visits-read`, the `validateur` role).
- `pnpm content:pending` and « À valider » share their sources by convention, not code (decision 0040).
- Static pages (home) are not counted by the visit counter (0038).
