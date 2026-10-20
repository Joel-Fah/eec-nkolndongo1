# Phase 02 — Platform Core: report

_Branch `feat/phase-02-platform-core` · 2026-10-19 → 2026-10-20 · written at Checkpoint C._

## What was built
- **Database and identity** (Checkpoint A): Neon + Drizzle (migrations in their own commits), self-hosted Better Auth
  with bcrypt inside Postgres (decision 0018), sliding sessions, Google sign-in for members only, single origin
  (0017: site, admin, API, media in one Worker).
- **Access control and audit**: roles, permissions, group-scoped grants, `can()`/`requirePermission`, a route-table
  test that fails if a mutating route is unguarded, an audit log (24 months).
- **Module system** (Checkpoint B): `modules/` registry, feature flags, shared kits, boundary test; the **settings**
  module; users, roles, groups, activity log, outbox (0019), Mon compte; the living guide gated by `core:system-design`.
- **Media** (Checkpoint C): see decision 0020 and `modules/media/README.md`.
- **Members**: admin list/records/CSV, headcount dashboard; Mon espace data rights (consents, copy of my data, deletion
  with grace, devices); daily retention job.
- **Privacy and hardening**: privacy page rewrite (draft, `[À VALIDER]`), security headers (CSP, HSTS over https,
  Referrer-Policy, Permissions-Policy, nosniff, COOP), `SITE_INDEXABLE` flag with robots.txt, `X-Robots-Tag` and a ribbon.
- **Ops**: `deploy`, `preview`, `backup` workflows; encrypted weekly backup and a restore that was actually run (0022);
  `docs/ops/runbook.md`, `docs/ops/incident.md`.
- Also this phase (not in the original brief): the public UI revamp (heroes, mega menu, navbar pods, seasonal footer
  playground, error pages) and the admin shell/login redesign, all with the living-guide entries.

## Decisions
0017 single origin · 0018 auth · 0019 outbox · 0020 media storage · 0021 settings freshness · 0022 backups ·
0023 Erode · 0024 Storyset · 0025 admin path · 0026 footer playground.

## Measurements
| What | Result | Target |
|---|---|---|
| Admin initial JS (entry + preloaded chunks) | **237 KB gz** (was 282 before pruning the public texts out of the admin) | ≤ 250 |
| Admin heaviest lazy route | settings/media ≈ 5–10 KB gz each | — |
| Public site: largest script | 5.5 KB gz (ClientRouter); playground 5.1 KB gz, loaded only when the footer is near | ≤ 100 |
| Member island (Mon espace script) | 3.0 KB gz | ≤ 60 |
| EXIF/GPS | a JPEG carrying GPS-like EXIF → 3 uploaded variants, **0 contain EXIF/GPS** | stripped |
| Media route | Range 206, ETag, nosniff, traversal 404, listing 404, anonymous upload 401, HTML refused (bad type) | — |
| Backup / restore | 19 tables, 8 KB encrypted; restore into an empty database: all counts identical; non-empty target refused | tested |
| Retention run (dev) | expired sessions removed, 2 accounts past grace purged, account within grace kept, run logged | — |
| Auth CPU timing on Workers | **not measured**: needs a deployed preview (Cloudflare login done; deploy needs Joël's OK) | ≤ 10 ms |

## Deviations and why
- **Media encoders**: native `OffscreenCanvas` (WebP, JPEG fallback where WebP encoding is missing) instead of jSquash WASM:
  no extra dependency, smaller, EXIF removed by construction; AVIF skipped. Revisit if Safari quality matters.
- **Object storage**: Neon (S3-compatible) instead of R2 (no payment method yet); R2 later = four variables and a copy.
- **Backups** are a logical NDJSON dump encrypted with age (no `pg_dump` available), not a `pg_dump` file.
- **Weekly backup runs in GitHub Actions**, the one exception to « schedules on Cloudflare » (a Worker cannot dump).
- **Noindex flag** is `SITE_INDEXABLE` (build time, default off) rather than `PUBLIC_LAUNCHED`.
- **Admin message pruning**: only the namespaces the admin uses are bundled (a test guards it).

## Not done / known issues
- **First production deploy** (needs Joël present): Cloudflare token + account id as GitHub secrets, Neon `main` branch,
  Hyperdrive binding, Worker secrets, the age key pair (`scripts/backup/keygen.ts`), then the Worker CPU measurement.
- **Pexels curation into the library** (24–36 images): the pipeline exists, the selection needs Joël's review of thumbnails.
- **Media files have no second copy** (database backups do). Decide: R2, or a periodic copy to Google Drive.
- Keyboard and screen-reader pass done on the auth forms, media library and Mon espace by structure (labels, roles, focus),
  not with a screen reader. The role matrix labels were done in Checkpoint B.
- Bible verse wording (PDV/ETR) to verify against the licensed text; login testimonials empty on purpose.
- Public pages with the database unreachable: static pages are prerendered and never wait for the database; the footer
  and season fall back to built-in values (not exercised with a real outage).
- Hero figures and photos remain dev-only placeholders.

## Suggestions for Phase 03
Content modules (news, events, liturgy, schedule, departments, guides, contact, giving) on the `new-module` skill,
using `<Picture>` and the media picker (a reusable `<MediaPicker>` is the next component to build), real email once a
domain exists, the media second copy, and a Lighthouse/E2E pass before the public launch.
