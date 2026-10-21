# Architecture

Status: **foundations built (Phase 01)**: monorepo, brand, tokens, primitives, public shell and admin shell.
Database, auth, API modules and content are Phase 02+. Rationale for each choice lives in `docs/decisions/`.

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
| Files | **Cloudflare R2** | Images, PDFs, sermon audio. Free egress, served via Cloudflare CDN |
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
  <module>/       One folder per feature (see §4) — today: settings
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

- Story pages (Accueil shell, Notre histoire, Ce que nous croyons…) are **prerendered** at build time.
- Live content (actualités, agenda, prédications, horaires) uses **on-demand rendering** or public JSON in
  the Worker, cached at the edge with the Cache API: short freshness + stale-while-revalidate, last good
  value if the database is down, and a **content version** in the cache key so a save shows up within
  seconds — no zone, so no global purge yet (decision 0021). Content changes never require a CI build.
- Parish settings reach static pages through a tiny client script reading `/api/settings/public`
  (approved values only); pages never wait for the database.
- The public site reads via `packages/db` read-only queries; all writes go through `apps/api`.

## 7. Media pipeline

- Upload (admin) → API validates type/size → image resized to responsive AVIF/WebP variants → R2.
- Audio: normalised to mono Opus/MP3 at speech bitrates before upload (keeps sermons ~15–25 MB/hour).
- Video: YouTube URL only; the site stores the ID and renders a lightweight facade.
- Drive: manual or scripted archive of originals; R2 keeps only web-ready versions.
- Placeholder imagery: curated once from Pexels (no people), stored in R2 with credits (see skill
  `pexels-curation`).

## 8. Low-data & resilience

- No third-party requests on page load (fonts, icons, images all first-party).
- `Save-Data` / `prefers-reduced-data` → no autoplay, lower image tier, motion reduced.
- Maps, video, audio load on explicit tap.
- PWA (phase 2): installable, offline read of recent news/agenda/bulletin.

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
