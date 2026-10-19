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
| API | **Hono** on **Cloudflare Workers** | Single place for validation and permission checks |
| Database | **Neon Postgres** (free plan) | Accessed with **Drizzle ORM**; connection via Hyperdrive or Neon serverless driver |
| Auth | **Neon Auth** (managed Better Auth) | Identity only. Authorization is ours (see §5) |
| Files | **Cloudflare R2** | Images, PDFs, sermon audio. Free egress, served via Cloudflare CDN |
| Video | **YouTube** | Embedded with a click-to-load facade |
| Archive | **Google Drive** | Raw originals / backups only — never served to the site |
| Email | **Brevo** (transactional + newsletter) | Templates in React Email (`packages/emails`). Needs a domain → later |
| Styling | Tailwind CSS v4 + CSS custom-property tokens (generated from `packages/ui/src/tokens.ts`) | `packages/ui` |
| Motion | **GSAP** (ScrollTrigger, SplitText, MorphSVG) + CSS | Per-page loading only |
| Icons | Hugeicons free, stroke-rounded | `@hugeicons/core-free-icons` |
| Fonts | **Switzer** (text/UI, Fontshare, fetched at build, not committed) + **Fraunces** (headings, OFL, subset, committed) | Self-hosted WOFF2, decision 0015 |
| Payments (later) | **pawaPay** | MTN MoMo + Orange Money Cameroon (XAF) |
| Hosting | Cloudflare (Workers static assets / Pages) | Free plan |

## 3. Repository layout

```
apps/
  web/            Astro public site + member space (/[lang]/...)
  admin/          Vite React SPA (staff dashboard)
  api/            Hono Worker (REST, JSON, Zod-validated)
packages/
  db/             Drizzle schema, migrations, query helpers
  auth/           Neon Auth client + session helpers + permission checker
  ui/             Tokens, shared CSS, brand SVGs, illustrations, Astro + React primitives, icon registry
  i18n/           FR/EN dictionaries, formatters (dates, XAF), locale utils
  emails/         React Email templates
  config/         tsconfig bases, Biome config (decision 0013)
  core/           framework-free utilities: liturgical calendar, slugs
  scripts/        (workspace) fonts fetch, contrast check, brand icons, design-rules check, brand tracing
modules/
  <module>/       One folder per feature (see §4)
scripts/          One-off tooling (pexels curation, seeding, image optimisation)
docs/             All documentation
.claude/skills/   Project skills for Claude
```

## 4. Module system

Every feature (news, events, sermons, departments, giving, members, …) is a module:

```
modules/events/
  module.ts        manifest: id, labels (fr/en), permissions, nav entries, feature flag default
  schema.ts        Drizzle tables (prefixed: events_*)
  api.ts           Hono routes, mounted at /api/events
  admin/           React pages/components for the dashboard
  web/             Astro components/pages fragments for the public site
  i18n/fr.json, en.json
  README.md        purpose, data kept, retention, owners
```

- `modules/registry.ts` lists enabled modules. The API, admin nav, public routes, permissions seed and
  i18n bundles are **generated from the registry** — adding a module = adding a folder + one line.
- Each module declares its **permissions** as `module:action` strings (e.g. `events:create`,
  `events:publish`). They are seeded automatically and appear in the role editor.
- Feature flags (DB table `settings_flags`) let the super admin hide a module without a deploy.
- Modules may depend on `packages/*` but **never import another module's internals** — use its API or
  exported types.

## 5. Identity, roles and permissions

- **Neon Auth** answers *who are you* (email + password / magic link first; phone OTP later).
- **Our tables** answer *what can you do*:
  - `roles` (e.g. Super admin, Secrétariat, Éditeur, Responsable de département, Trésorier, Membre)
  - `permissions` (seeded from module manifests)
  - `role_permissions`
  - `groups` (departments, committees: JAPE, UFC, Chorale X…)
  - `user_roles` (user, role, optional `group_id` scope → "Responsable JAPE" can only manage JAPE content)
- The super admin manages roles, groups and assignments from the admin UI.
- **Every API handler** calls `requirePermission(ctx, 'events:publish', { groupId })`. The admin UI
  hides what the user can't do, but the API is the source of truth.
- Members log in on the **public site** only (`/fr/mon-espace`). Staff accounts can be members too.
- Audit log table records who changed what (create/update/delete/publish) for accountability.

## 6. Rendering & content freshness

- Story pages (Accueil shell, Notre histoire, Ce que nous croyons…) are **prerendered** at build time.
- Live content (actualités, agenda, prédications, horaires) uses **on-demand rendering** in the Worker,
  cached at the edge; publishing from the admin **purges the cache** for affected URLs.
  → Content changes never require a CI build.
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
