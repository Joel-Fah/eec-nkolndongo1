# STATUS

## Current phase: 04a — Go-live · Checkpoint A (launch kit) ready for review
_Last updated: 2026-10-23._ Branch `feat/phase-04a-go-live` (from `main`, which already carries Phase 03: both PRs were merged and
the `deploy` workflow shipped them, migrations 0006–0018 included, on 2026-10-22). **Dev only for everything new**; nothing of
04a is deployed. Report in progress: `docs/phases/PHASE_04_REPORT.md`.
**Built (A):** home texts and four key figures as slots (0039); « Validateur de contenu » role + **À valider** screen with
comments (0040); **Aide** (11 guides + 4 printable cheat sheets, « ? » on each screen); **Santé** (daily check in the existing
cron, backup mark, dashboard insight); **visit counts** coded but dormant (0038); share cards, JSON-LD (Church, NewsArticle, Event,
BreadcrumbList), an on-demand **sitemap**, `docs/ops/launch.md`; Checkpoint 0 carry-overs (signed contact timestamp, prayer-request
access test, separate preview Worker on dev data).
**Deferred on purpose (Joël, 2026-10-22: production work not now):** the production audit/seed/role grants, real-phone readings
(CPU, LCP, CLS, egress), TalkBack + keyboard + tap-to-dial + `.ics` device pass, and the R2 / launch-address answers. They gate the
PR merge (merging deploys) and Checkpoint B's audio decision (0034), not the dev work.
**Checkpoint B (sermons, links only, decision 0034) built on dev:** see `docs/phases/PHASE_04_REPORT.md`.
**Checkpoint C built on dev (2026-10-23):** meditations (real 2026 calendar; passages entered as book/chapter/from/to with
chapter and verse limits; CSV template + row-by-row preview), bulletin (parts ticked from existing data, never retyped), and
**registrations** (decision 0035 accepted: phone required with/without +237, age bands, retention 6 months with a coloured countdown
in the admin, open and members-only forms, CSV export for super admin + secretariat, waitlist promotion via the outbox, check-in,
works without JavaScript). Migration 0024 (additive) applied on dev only. Everything printed carries the logomark and full names.
**Checkpoint D built on dev (2026-10-24):** campaigns (decision 0041, migration 0028), PWA (decision 0037), scope-matrix and e2e
extensions; details in `docs/phases/PHASE_04_REPORT.md`. Production steps and real-phone tests are Joël's.
**Checkpoint E (2026-10-24):** the Moissons page for members in season (0042), Sunday reports with trends (module `sundays`, 0043, migration 0029),
the site opening on Ce dimanche on Sundays. Details in the report. **Checkpoint E+ (2026-10-25):** Sunday report on any named church day, notification bell with Sunday reminders (0044, migration 0031 on dev only); the editor can propose Sunday figures, validated by the secretariat or treasurer (0045, migration 0032 on dev only); validator reminders and a weekly summary; quick actions for the Sunday report and news; per-person notification mutes (0046, migration 0033 on dev only). **Checkpoint F (2026-10-25):** member profile (details behind a `profile` consent, private photo with levels, generated avatar, tilting member card, completeness warnings in the public header and the admin top bar: 0047, migration 0034 on dev only), brand date and time pickers (admin and public), translation icon on language notes, social media kit and credits in the brand guide, `owasp-security` skill, ARCHITECTURE and CLAUDE refreshed.
**Known gaps:** « Mes inscriptions » in Mon espace; per-event `.ics` on the confirmation page (the event page has it); the
Hébreux 8, 19 typo in the parish's 2026 calendar (real error, flagged by the new checks).
**Next:** Joël's review of A, B and C → PR 04a (merge = production deploy, after a Neon backup branch) → Checkpoint B (sermons + podcast:
video-only first; audio after 0034).

## Previous phase: 03 — Parish Life (merged into main, deployed 2026-10-22)
Full details: `docs/phases/PHASE_03_REPORT.md`.

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

## Phase 03b — started (branch feat/phase-03b-people-pages, from 03a)
- **C · departments: done (dev).** Module `departments` (migration 0012 applied on dev only), scoped editing, people with
  recorded consent (name/photo public only with it), public index with audience filter + « Où est ta place ? » quiz
  (editable in admin, nothing stored), group page (approved times, latest news, next events, contact). Dev seed adds
  fictional « Exemple — » groups. Next in C: guides, page slots + history climb, council.
- **C · guides: done (dev)** (migration 0013): steps checklist with browser-only ticks, print view, admin editor. « Poser
  une question » points to « Nous trouver » until the contact form exists (D).
- **C · story pages: done (dev)** (module `story`, migration 0014): content slots (histoire intro/closing line, croyances
  intro, pasteurs governance), history milestones with the « Gravir la colline » trail (GSAP on that page only), council with
  recorded consent. Drafts by default; editing without `story:publish` takes a text back to draft.
- Not yet in C: home hero texts / invitation / key figures as slots (still `lib/stats.ts` + i18n); 03b D (search, contact,
  giving, Nous trouver, legal, launch readiness).
- `/_brand` entries added for the new components.

## Round 5 UI (2026-10-21, Joël's feedback before B approval)
- Home « Ce dimanche » smaller with time tile; cherry blossom keeps its white flowers (recoloured to our palette; its background layer had been dropped). Immersive « Ce dimanche » page.
- Events page: filters and List/Month change results without reloading; sticky week index. Liturgical dial: arc scales on selection.
- Editor: max height inline, rounded tables, fullscreen header/labels/popovers; liturgy grid + icon remove; schedule sorted by time.
- Next: Checkpoint B approved after these → start 03b (C: departments, guides, pages, council; D: search, contact, giving, legal).

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
