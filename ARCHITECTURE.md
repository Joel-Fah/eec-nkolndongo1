# Architecture

Status: **Phase 04 built on dev** (see `STATUS.md`): platform core, parish life modules, go-live kit, sermons, meditations, bulletin,
registrations, campaigns, Sunday reports, notifications, PWA. Rationale for each choice lives in `docs/decisions/`.

## 1. Goals that shape the architecture

- Near-zero running cost (free tiers), one developer, easy for Claude and humans to extend.
- Very light public pages on mobile data; rich, story-driven interactions where they matter.
- Features plug in as **modules** without touching unrelated code.
- Two audiences, one backend: public visitors/members and parish staff with fine-grained permissions.

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Shared TS config, cached tasks |
| Public site | **Astro** (+ React islands only where needed) | Static by default, on-demand rendering for live content, built-in i18n routing, View Transitions |
| Admin | **Vite + React + TypeScript** | TanStack Router, TanStack Query, React Hook Form + Zod, **Base UI** primitives skinned with our shared CSS (decision 0016) |
| API | **Hono**, mounted in the site's Worker under `/api` (single origin, decision 0017) | Single place for validation and permission checks |
| Database | **Neon Postgres** (free plan) | **Drizzle ORM** + `pg`; Hyperdrive in production, direct connection locally |
| Auth | **Better Auth**, self-hosted on our Neon database (decision 0018) | Identity only. Authorization is ours (see §5) |
| Files | **S3-compatible bucket**: Neon Object Storage now, Cloudflare R2 later (decision 0020) | Images and PDFs through `/media/<key>` (edge-cached); the bucket is never public |
| Video | **YouTube** | Embedded with a click-to-load facade |
| Archive | **Google Drive** | Raw originals / backups only — never served to the site |
| Email | Outbox now (decision 0019); **Brevo** later | Needs a domain. Invitations and staff resets are links |
| Styling | Tailwind CSS v4 + CSS custom-property tokens (generated from `packages/ui/src/tokens.ts`) | `packages/ui` |
| Motion | **GSAP** (ScrollTrigger, SplitText, MorphSVG) + CSS | Per-page loading only |
| Icons | Hugeicons free, stroke-rounded | `@hugeicons/core-free-icons` |
| Fonts | **Switzer** (text/UI, Fontshare, fetched at build, not committed) + **Erode** (headings, Fontshare, fetched the same way — decision 0023) | Self-hosted WOFF2, decision 0015 |
| Payments (later) | **pawaPay** | MTN MoMo + Orange Money Cameroon (XAF) |
| Hosting | Cloudflare (Workers static assets / Pages) | Free plan |

## 3. Repository layout

```
apps/
  web/            Astro public site + member space (/[lang]/...)
  admin/          Vite React SPA (staff dashboard)
  api/            Hono app (REST, JSON, Zod-validated), mounted at /api by the web Worker
packages/
  db/             Drizzle schema, migrations, query helpers
  auth/           Better Auth config, sessions, permissions (can), audit, links, core module + system roles
  api-kit/        What every API router needs: request context, guards, audit(), edge cache, content versions
  admin-kit/      What every admin screen needs: API client, locale/translations, session hooks
  ui/             Tokens, shared CSS, brand SVGs, illustrations, Astro + React primitives, icon registry
  i18n/           FR/EN dictionaries, formatters (dates, XAF), locale utils
  emails/         React Email templates
  config/         tsconfig bases, Biome config (decision 0013)
  core/           framework-free utilities: liturgical calendar, slugs
  scripts/        (workspace) fonts fetch, contrast check, brand icons, design-rules check, brand tracing
modules/
  registry.ts     The single list of modules (data only)
  api.ts, admin.ts  Their API routers and admin pages (server / browser sides of the registry)
  <module>/       One folder per feature (see §4) — settings, media, members, news, events, schedule, liturgy,
                  departments, guides, story, contact, legal, sermons, meditations, bulletin, registrations, campaigns,
                  sundays, cli (search and the admin « À faire » / notifications roll-ups live with the API)
scripts/          One-off tooling (pexels curation, seeding, image optimisation)
docs/             All documentation
.claude/skills/   Project skills for Claude
```

## 4. Module system

Every feature (news, events, sermons, departments, giving, members, …) is a module:

```
modules/events/                 workspace package @eec/module-events
  src/index.ts     public entry: manifest (defineModule) + shared types — the only thing others import
  src/schema.ts    Drizzle tables (picked up by drizzle-kit)
  src/api.ts       Hono router (@eec/api-kit guards), mounted at /api/events
  src/admin.tsx    the admin page, loaded on demand at /admin/m/events
  i18n/fr.json, en.json   merged into the shared messages under the `events.` namespace
  README.md        purpose, data kept, retention, owners
```

- `modules/registry.ts` lists the modules; `modules/api.ts` and `modules/admin.ts` map them to their router
  and page. The API mounts, the admin menu (filtered by rights and flags), the permission seed
  (`pnpm db:seed`) and the i18n build all read the registry — adding a module = a folder + three lines.
- Each module declares its **permissions** as `module:action` strings (e.g. `events:create`,
  `events:publish`). They are seeded automatically and appear in the role editor.
- Feature flags (DB table `settings_flags`) let the super admin hide a module without a deploy.
- Modules may depend on `packages/*` but **never import another module's internals** — only its public
  entry. Enforced by `modules/boundaries.test.ts` (no app imports, no deep imports, no escaping the folder).
- A switched-off module answers 404 on its API and disappears from the admin menu.

## 5. Identity, roles and permissions

- **Better Auth** (self-hosted, decision 0018) answers *who are you*: email + password now, Google for members
  later; passwords hashed in Postgres (bcrypt) to stay within the Worker's CPU budget.
- **Our tables** answer *what can you do*:
  - `roles` (e.g. Super admin, Secrétariat, Éditeur, Responsable de département, Trésorier, Membre)
  - `permissions` (seeded from module manifests)
  - `role_permissions`
  - `groups` (departments, committees: JAPE, UFC, Chorale X…)
  - `user_roles` (user, role, optional `group_id` scope → "Responsable JAPE" can only manage JAPE content)
- The super admin manages roles, groups and assignments from the admin UI.
- **Every mutating API route** starts with `requirePermission('events:publish', { group })`, `requireSelf()`
  or `publicRoute('why')`; a test walks the route table and fails otherwise. Rights are re-read on every
  request. The admin UI hides what the user can't do, but the API is the source of truth.
- Members log in on the **public site** only (`/fr/mon-espace`). Staff accounts can be members too.
- Every mutation writes to the audit log (`audit(c, …)`): who, what, when, a changed-fields diff with secrets
  scrubbed, a salted IP hash. Viewable and exportable (super admin) in the admin.
- **The admin's address** is `ADMIN_PATH` (default `/admin/`; decision 0025), tolerant of typos in the value.
- **Internal pages** (`/fr/_brand/`, `/en/_brand/`) are static but gated: `run_worker_first` sends them to
  our Worker entry (`apps/web/src/worker.ts`), which serves them only to a session with `core:system-design`
  and otherwise returns the normal 404.

## 6. Rendering & content freshness

- The Accueil shell and the remaining static pages are **prerendered**; every page that shows live content (news, agenda,
  horaires, Ce dimanche, départements, guides, the story pages, Donner, Nous trouver, legal, search) is **rendered on demand
  from cached public JSON** (decision 0027). Story pages keep their structure and animation in code and take their words and
  people from the admin (module `story`); an unpublished text never replaces the built-in one.
- Live content (actualités, agenda, prédications, horaires) uses **on-demand rendering** or public JSON in
  the Worker, cached at the edge with the Cache API: short freshness + stale-while-revalidate, last good
  value if the database is down, and a **content version** in the cache key so a save shows up within
  seconds — no zone, so no global purge yet (decision 0021). Content changes never require a CI build.
- Parish settings reach static pages through a tiny client script reading `/api/settings/public`
  (approved values only); pages never wait for the database.
- The public site reads via `packages/db` read-only queries; all writes go through `apps/api`.

## 7. Media pipeline

- Upload (admin) → photos are resized and re-encoded **in the browser** (WebP; JPEG where WebP encoding is missing) → API checks type/size by first bytes → S3-compatible bucket (decision 0020).
- Audio: normalised to mono Opus/MP3 at speech bitrates before upload (keeps sermons ~15–25 MB/hour).
- Video: YouTube URL only; the site stores the ID and renders a lightweight facade.
- Drive: manual or scripted archive of originals; the bucket keeps only web-ready versions.
- Placeholder imagery: curated once from Pexels (no people), stored in the bucket with credits (see skill
  `pexels-curation`).

## 8. Low-data & resilience

- No third-party requests on page load (fonts, icons, images all first-party).
- `Save-Data` / `prefers-reduced-data` → no autoplay, lower image tier, motion reduced.
- Maps, video, audio load on explicit tap.
- PWA (decision 0037): a hand-written service worker (`apps/web/src/sw/sw.js`, built by `pages/sw.js.ts`, stamped per build), per-locale manifest, FR/EN offline pages.
  Public pages only (max 40 saved); never admin, API, auth, Mon espace, previews, registration, search or anything `private` / `no-store`.

## 9. Environments

| Env | Web/Admin/API | DB |
|---|---|---|
| local | `pnpm dev` (wrangler for API) | Neon dev branch |
| preview | manual deploy only (`workflow_dispatch`) | Neon preview branch |
| production | deploy on merge/tag to `main` (path-filtered) | Neon main branch |

CI/CD rules: `docs/ops/ci-cd.md`. Domain: not chosen yet — `*.workers.dev` / `*.pages.dev` until then.

## 10. Design system documentation
`/fr/_brand` and `/en/_brand` (apps/web) are the **living brand guidelines and design-system docs**: identity,
voice and tone, logo, colour, type, shape, motion, icons, illustration, every component and rule. They are
`noindex`, unlinked and out of the sitemap — **unlisted, not private**; access control comes with auth
(Phase 02). New components, animations and tokens are documented there in the same change.

## Phase 02 additions
- `modules/media` (library, `/media/<key>`), `modules/members` (admin list, export, headcount), `apps/api/src/retention.ts`
  (daily Cron), security headers (`packages/api-kit/src/security-headers.ts`), backups (`scripts/backup/`). See the decisions
  0020, 0022 and `docs/ops/runbook.md`.

## Phase 03 additions
- Content modules: `news`, `events`, `schedule`, `liturgy`, `departments`, `guides`, `story` (page slots, history milestones, council),
  `contact` (form + inbox), `legal` (versioned documents). Shared kit: `@eec/core` (rich text, lifecycle, recurrence, ICS,
  schedule, liturgy, bible refs, departments quiz, page slots), `@eec/api-kit` (`contentRoutes`, cache, preview links,
  guards), `@eec/content-kit` (editor, media picker, publish dialog, revisions, guarded dialog).
- Cross-module pieces live in the registry package, not in a module: `modules/search.ts` (decision 0030) and, in `apps/api`,
  `routes/todo.ts` (admin « À faire ») and `policy.ts` (the privacy-policy version in force, decision 0033).
- Decisions: 0027 (rendering), 0028 (rich text), 0029 (events), 0030 (search), 0031 (people and consent), 0032 (Bible
  translations), 0033 (legal versions). Content truth: `pnpm content:pending`. Manual end-to-end run: `pnpm e2e`.

## Phase 04 additions
- **Modules:** `sermons` (links only, 0034), `meditations` (CSV import, passages as references), `bulletin` (assembled from the site's own data),
  `registrations` (waitlist, check-in, retention, 0035), `campaigns` (Moissons: validated totals only, 0041), `sundays` (Sunday reports:
  aggregates only, special days, proposed figures validated by the secretariat or treasurer, 0043 / 0044 / 0045).
- **Cross-module data is read by table name with raw SQL, never by importing another module** (`modules/boundaries.test.ts`): `sundays` feeds
  `campaign_progress`; `apps/api/src/routes/todo.ts` and `notifications.ts` are roll-ups across modules.
- **Notifications** (0044 / 0046): table `notifications` + `notification_mutes`; reminders are worked out when the list is read (no scheduler),
  one row per person and thing (kind + params, never text), grouped by week, with a deep link; resolved by themselves; four kinds a person can mute.
  The admin bell is `apps/admin/src/components/Notifications.tsx`; pure rules in `apps/api/src/routes/reminders.ts`.
- **Member-only pages:** `/api/me/membership`; the Moissons page is `private, no-store`, `noindex`, in the service worker's private list (0042).
- **Pickers:** `DatePicker` / `TimePicker` in `packages/ui/react/pickers.tsx` (admin, wrapped as `DateField` / `TimeField` in `@eec/admin-kit`)
  and `packages/ui/src/pickers.ts` (public, native popover). No date library.
- **Share cards, JSON-LD, sitemap:** `scripts/og-generate.ts`, `scripts/jsonld-check.ts`, on-demand `/sitemap.xml`; the launch kit is `docs/ops/launch.md`.
- **Checks you can run:** `pnpm check` (lint, typecheck, tests incl. route-table, scope matrix, boundaries), `pnpm e2e` (local stack only).
- Decisions 0034–0047 are listed in `docs/decisions/README.md`.

## Phase 05 additions
- **Mon espace** (`docs/product/mon-espace.md`): a static page, full width once signed in (welcome, side menu, bento home, five sections warmed after the first paint); everything is drawn from `/api/me/*`, `/api/communion/me`, never cached
  (`private, no-store`). Scripts `apps/web/src/scripts/mon-espace.ts`, `me-*.ts`. The notification count lives on the avatar in the public header (`account-badge.ts`).
- **Groups for members** (0049): `group_requests` (a person waiting is not a member), `group_members.share_phone`, `/api/group-space` (« Mon groupe »: roster, requests, removal, audited export; every route checks the right *for that group*),
  `announcements` module (scoped by group, notifies the members).
- **Communion cards** (0050, module `communion`): propose → a second person approves; the Elders sign the month and keep the contributions register; signed QR (`signPreview` over card id + version; renewing stops old codes) to `/verifier/?t=…`
  (public, rate-limited, first name + initial only); the card is copied to IndexedDB for offline use; the service worker may keep the **empty shell** of Mon espace only (0037 amended). One dependency: `qrcode-generator` (API only).
- **Data rights log** (0052, module `rights`): requests from people without an account, with the deadline; a staff notification when one is overdue.
- **System-role grants are offered once** by the seed (0048, ledger `role_permission_offers`). **Push is not built** (0051).
- Decisions 0048–0052 are in `docs/decisions/README.md`. Migrations 0035–0040.
