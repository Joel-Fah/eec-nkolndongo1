# STATUS

_Last updated: 2026-10-21_

## Current phase: 03a — Parish Life · Checkpoint A (content kit + News) ready for review
Branch `feat/phase-03a-content-time`. Production stays paused (dev only), nothing deployed. Plan: `docs/phases/PHASE_03_INSTRUCTIONS.md`.
- **Checkpoint 0 done:** `cachedJson` refresh bug fixed (own connection), cache hits no longer open a DB connection (version and
  module flags memoised), cold reads time-boxed (503, never 500), CPU figures in decision 0027, public-domain Bible verses
  (LSG 1910 / WEB, decision 0032), CI `--env-file-if-exists` fix.
- **Content kit:** `@eec/core` rich text (clean + render, hostile-input tests) and lifecycle; `@eec/api-kit` preview links
  (signed, 3 days); `@eec/content-kit` (TipTap editor loaded lazily, media picker, publish dialog, revisions, autosave,
  cover field, status badge); `content_revisions` / `content_redirects` (migration 0006); media tables moved to `@eec/db`.
- **News module:** admin list + editor (FR/EN tabs, autosave, schedule, unpublish, archive, delete, versions, preview link,
  group-scoped rights), public list/detail/preview pages (on demand, cached JSON), RSS, home « Dernières nouvelles »,
  dev-only example seed (`pnpm news:seed-dev [-- --clear]`). Entries added to the living guide.
- **Next:** Checkpoint B (events, schedule, liturgy, home cards). **Open:** real CPU reading on production, TipTap chunk is
  125 KB gz (admin only), news permissions are not added to existing roles in a database already seeded (grant in Rôles).

## Previous phase: 02 — Platform Core · Checkpoint C (media, members, deploy prep)

## Checkpoint C — built (2026-10-20), waiting for Joël's review
- **Media library** (`modules/media`, decision 0020): S3-compatible store (Neon Object Storage, bucket `eec-media`), photos
  resized and stripped of EXIF/GPS in the browser (Web Worker), ThumbHash, audio/PDF streamed through, `/media/<key>`
  public route (Range, ETag, immutable), admin screen (drop zone, required descriptions, filters, details, archive/delete
  with usage check, space meter), Astro `<Picture>`.
- **Members** (`modules/members` + Mon espace): admin list/records/CSV export (audited), headcount dashboard with SVG
  trend + table, Mon espace panels (profile, consents, copy of my data, deletion with 30-day grace, devices).
- **Retention**: daily Cloudflare Cron (`apps/api/src/retention.ts`), each run logged in `retention_runs`.
- **Privacy page** rewritten (FR/EN, `[À VALIDER]`); **security headers**, noindex flag (`SITE_INDEXABLE`), ribbon, robots.txt.
- **Ops**: `deploy`, `preview`, `backup` workflows; encrypted backups + **tested restore** (decision 0022); runbook, incident doc.
- **Not done yet**: the first production deploy (needs Joël present, a Cloudflare token + Neon `main` branch + Hyperdrive),
  Worker CPU measurement on a deployed preview, the Pexels curation into the library (needs Joël's review of thumbnails),
  a second copy of the media files. See `docs/phases/PHASE_02_REPORT.md`.
- **Live (2026-10-21):** first production deploy done on `eec-nkolndongo1.joelfah2003.workers.dev` (noindex), admin at a custom
  path, super admin created. **To do later:** R2 second copy of the media files (enable R2, bucket `eec-media-copy`, four
  `MEDIA_COPY_*` GitHub secrets: nothing to copy yet), a safe preview workflow (dev database), Worker CPU reading. **Pexels:** 61 approved photos (no people) imported into the production and dev media libraries
  (`scripts/pexels/import-library.ts`), descriptions marked `[À VALIDER]`; public credits page (`/fr/credits-photos/`) and footer link done.
- **Open points**: Bible texts (PDV/ETR) to verify against licensed wording; testimonials empty on purpose; real parish photos.

## In progress — public UI revamp (asked by Joël, 2026-10-19)
Joël rejected the Phase 01 page layouts. Direction: SaaS-sleek (Supabase/Neon feel) for a church, each
page with its own concept. Vertical slice done, **waiting for Joël's review** before rolling out to every page:
- Erode replaces Fraunces (decision 0023); fields: required placeholders, stronger focus state.
- Preloader: small centred badge, the mark drawn as line art then filled; the page waits for it.
- Floating footer (invitation, site map, cropped « Nkolndongo »).
- Home: card stream hero (pause button), key figures (`lib/stats.ts`, null until validated), bento grid,
  season ring. Mon espace: one card, two tabs, three-step sign-up, member dashboard.
- Round 2 (Joël's feedback): preloader draws the short lockup (mark + « EEC / Nkolndongo 1 »); navbar
  active tab = soft tint; hero title on two lines, slower stream mixing portrait/landscape, eased pause on
  hover; footer split (CTA card, sober footer, legal line below); season strip with countdown.
- Illustrations: Storyset Cuate, recoloured to our palette, never committed (decision 0024, `pnpm illos:fetch`).
- Round 3: every page has its own hero (`lib/heroes.ts`, 15 layouts, near full-screen photo + cards) and
  a restyled body (numbered editorial sections, check cards, bento cards, gold verse band; the Creed lights
  up phrase by phrase). Hero figures are examples in dev only, hidden in production until validated.
- ⚠ Privacy page text says no personal data is collected: false since Mon espace — rewrite with the data
  protection docs (Phase 02 wrap-up) before any public launch.
- Pexels photos of people: **dev-only** placeholders (gitignored, removed from builds; credits in
  `apps/web/src/content/placeholders.json`). Real, consented parish photos needed before launch.
- Next after review: every other page gets its own concept (`docs/product/pages.md`), then Checkpoint B.

## Round 4 UI (2026-10-20, Joël's feedback)
Mobile menu fixed (it inherited pointer-events:none from the header) + a visible × ; hero redone (centered
title, row of 1–4 shapes partly below the fold, pointer-following cards, full-screen-behind-navbar morph);
admin shell is Google-Cloud style (fixed sidebar + top bar, rounded join, left-aligned content); full-screen
admin login with a random photo and the logo always with the parish name; menu shows the current page's
illustration by default; new Storyset illustrations for news, sermons, meditations, events, home.
Google sign-in: members can link Google to an existing password account; staff are still refused.

## Checkpoint B — done, waiting for Joël's review (2026-10-20)
- Module system: `modules/` workspace, registry (+ API mounts, admin menu, permission seed, i18n merge),
  feature flags (switched-off module → API 404, menu hidden), boundary test. Shared kits: `@eec/api-kit`,
  `@eec/admin-kit`. `new-module` skill updated with the real APIs.
- Admin core: Utilisateurs (search/filters, invitation links, profile, roles with group scope, groups,
  sessions, activity, reset links, deactivate with undo), Rôles (permission matrix, duplicate, delete with
  typed confirmation), Groupes, Journal d’activité (filters, readable details, CSV for super admin), Boîte
  d’envoi, Mon compte (profile, language/theme, password, devices). Every mutation guarded + audited.
- Settings module: parish details + season (approval per field; only approved values public), flags,
  system info. Public site reads `/api/settings/public` (edge-cached, content version — decision 0021).
- `/fr/_brand` and `/en/_brand` gated by `core:system-design` via our Worker entry (`apps/web/src/worker.ts`).
- Decisions 0019 (outbox) and 0021 (settings freshness).
- Next (Checkpoint C): media module (Neon object storage), members module (Mon espace, export, deletion,
  retention Cron, headcount), privacy page rewrite, deploy workflows, first production deploy (with Joël),
  backup + tested restore.

## Phase 02 so far
Neon + Drizzle schema and migrations, self-hosted Better Auth (0018), RBAC + audit, invitations and reset
links, member sign-up with versioned consents, single origin (0017). Google sign-in for members only: approved,
needs a Google OAuth client (Joël). Worker CPU still to measure: `pnpm --filter @eec/web exec wrangler login`.

## Done in Phase 01 (report: `docs/phases/PHASE_01_REPORT.md`)
- Monorepo (pnpm 12 + Turborepo), Biome, Vitest, strict TypeScript; frugal CI check workflow.
- Brand: EEC mark redrawn as SVG (98.9 % overlap), lockups, favicons; Fraunces (now Erode, 0023) + Switzer; palette with
  state colours and nine liturgical seasons (158 contrast pairs pass); original illustration.
- Tokens generated from one file; shared primitives CSS; Astro (native) and React (Base UI) primitives.
- Public shell: header with mega-panels, mobile menu, footer, page transitions, localised placeholder
  pages, home, 404, SEO basics. Admin shell: sidebar, top bar, ⌘K palette, login UI, components gallery.
- Living brand guidelines and design-system docs at `/fr/_brand` (unlisted, noindex).
- Liturgical season util; FR/EN message system with French typography.

## Next — Phase 02
Database (Neon + Drizzle), auth (Neon Auth) and RBAC, settings and media modules, R2, first content
modules (news, events), access control for `/_brand`, deploy workflows. See the report's suggestions.

## Waiting on (people)
- Content validation partner — service times, history, council members, department list, address, socials.
- Real photos (in progress) — Pexels curation used meanwhile.
- MoMo / Orange Money merchant details + bank account (for "Donner").
- Domain — **on hold**, do not register.
- Real parish photos with consent (the hero and Mon espace use dev-only stand-ins).
- Real figures for the home (years, groups, Sundays, members) — `apps/web/src/lib/stats.ts`.
- Parish Council review of the brand-voice text (identity, tone) in `/_brand`.

## Open questions
- Épiphanie / Pentecôte season end dates and the Épiphanie + Semaine sainte colours (proposed, to confirm).
- Is the Délivrance ministry presented publicly? (council decision)
- Signature line for the parish (candidates in `/_brand` → Identité).

## Open points (2026-10-20)
- Bible verses on the admin login use Parole de Vie (FR) and Easy-to-Read Version (EN), version shown next to the
  reference. **To do:** check the wording against the licensed text and the publishers' quotation terms; later,
  let members choose their version in Mon espace. Testimonials stay empty until real, consented, validated ones exist.
- Google sign-in: `invalid_client` means `GOOGLE_CLIENT_SECRET` in `.env.local` does not match the client (re-copy it,
  no quotes or spaces, then restart `pnpm dev`).
