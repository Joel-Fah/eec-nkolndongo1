# Phase 02 — Platform Core: data, identity, permissions, media

> **Goal:** the backbone every future feature plugs into. That means:
> - a real database
> - accounts (staff and members)
> - roles and permissions that Joël manages from the admin
> - an audit trail
> - parish settings
> - a media library
> - the module system
> - a first production deployment on Cloudflare
>
> No content modules yet (news, events, etc. come in Phase 03). This phase is about trust and plumbing,
> done well.

| | |
|---|---|
| Owner | Joël Fah (approves checkpoints, owns accounts and secrets) |
| Builder | Claude Code |
| Branch | `feat/phase-02-platform-core` (sub-branches allowed, squash-merged into it) |
| Depends on | Phase 01 merged into `main`, plus `docs/phases/PHASE_01_REPORT.md` |
| Checkpoints | **A** data + auth spike · **B** permissions & admin core · **C** media, members, deploy |

---

## 0. Read first (mandatory)

1. `CLAUDE.md`, `STATUS.md`, `ARCHITECTURE.md`.
2. `docs/phases/PHASE_01_REPORT.md`. Phase 01's actual structure and names win over anything assumed
   here. If they conflict, adapt this plan and say so in your plan.
3. Decisions `docs/decisions/0001`–`0016`, especially 0004 (Neon), 0005 (auth & RBAC), 0006 (media),
   0008 (email), 0009 (Pexels), 0014 (Paraglide), 0015 (brand, and `/_brand` access).
4. `docs/legal/data-protection.md`, `docs/ops/ci-cd.md`, `docs/product/roadmap.md`.
5. Skills: `new-module` (central to this phase), `design-system`, `i18n-content`, `pexels-curation`,
   `release-checklist`.

**Verify before relying on memory.** Neon Auth, Better Auth, Cloudflare Workers/R2/Hyperdrive limits and
Drizzle APIs change often. Check the current official docs for every integration point. Cite what you
checked in your plan.

---

## 1. What Joël must provide (ask at the start, never guess)

Claude Code lists these in its plan and waits until they exist. **Secrets are never pasted into chat or
committed.** They go in gitignored local files (`.dev.vars`, `.env.local`) or Cloudflare/GitHub secrets.

| Item | Needed for | Notes |
|---|---|---|
| **Neon** account + project `eec-nkolndongo1` | Database, auth | Region closest to Cameroon (e.g. AWS Frankfurt `eu-central-1`). Branches: `main` (production), `dev`. |
| Neon connection strings (dev + main) | Local dev, deploy | Pooled and direct (migrations need direct). |
| **Cloudflare** account | Workers, R2, deploy | R2 may require a payment method on file even within the free tier. Joël decides. |
| R2 buckets `eec-media` (+ `eec-media-dev`), `eec-backups` | Media, backups | Private buckets, served through our Worker. |
| Cloudflare API token (scoped: Workers Scripts edit, R2 edit, Account read) | CI deploy | Goes in GitHub secrets. |
| **Pexels API key** | Placeholder curation (§9) | Local only. |
| Super admin email | Bootstrap (§4.6) | Joël's. Entered at the CLI, not hard-coded. |

---

## 2. Topology: one origin (decision 0017)

Before any auth work, settle this. It determines how cookies and sessions work.

- Without a custom domain we're on `*.workers.dev`. `workers.dev` is on the Public Suffix List, so
  **cookies cannot be shared between subdomains**. Separate origins for web, admin and API would mean
  CORS, plus third-party cookies (blocked by Safari and others).
- **Decision: serve everything from one origin.**
  - `/` and `/fr/…`, `/en/…` → public site (Astro, `apps/web` Worker)
  - `/admin/…` → admin SPA (static assets, Vite `base: '/admin/'`, SPA fallback to `/admin/index.html`)
  - `/api/…` → API (Hono). Either mounted through a **service binding** from the web Worker to the
    `apps/api` Worker, or the API mounted inside the web Worker. Pick one, measure, and justify it in 0017.
  - `/media/…` → R2-backed media route (§8)
- Sessions are **first-party cookies on that origin**: `HttpOnly`, `Secure`, `SameSite=Lax`, a narrow
  `Path`. No tokens in `localStorage`.
- Local dev reproduces the single origin (one dev entry point that proxies admin and API under the same
  host). `pnpm dev` must give one URL that serves all three.
- When a domain arrives later, nothing changes except the hostname.

Write `docs/decisions/0017-single-origin.md` and update `ARCHITECTURE.md` §2/§9.

---

## 3. Database (`packages/db`)

1. **Drizzle ORM** + **drizzle-kit**. Driver choice is verified against current docs:
   - preferred: **Cloudflare Hyperdrive** + a Postgres driver, *if Hyperdrive is available on the free
     Workers plan*. It gives pooling and lower latency to Neon.
   - otherwise: **`@neondatabase/serverless`**. HTTP for single queries, WebSocket `Pool` for
     transactions, one client per request.
2. **Migrations:** `drizzle-kit generate` → SQL files committed in `packages/db/migrations/`. Apply with
   `pnpm db:migrate` using the **direct** URL. **Never** use `drizzle-kit push` against `main`. Before
   migrating production, create a Neon backup branch (`pre-<migration>`).
3. **Conventions (shared helpers in `packages/db/src/columns.ts`):**
   - `id uuid primary key default gen_random_uuid()`
   - `created_at` / `updated_at timestamptz not null default now()`. `updated_at` is maintained in the
     repository layer or by trigger, consistently.
   - `created_by` / `updated_by uuid null references users(id) on delete set null`
   - bilingual text: `*_fr` (required) and `*_en` (nullable, falls back to FR on read)
   - soft state over deletes where history matters (`status`, `archived_at`)
   - snake_case tables and columns. Module tables prefixed with the module id (`media_files`).
4. **Neon free-plan guardrails:**
   - 1 GB per project → no binary data in Postgres, ever
   - compute sleeps after 5 min idle → the public site must never block on a cold DB for its shell
     (§7.3)
   - 5 GB egress/month → no large exports from public routes
5. **Seed:** `pnpm db:seed` (idempotent). It creates system roles, permissions from module manifests,
   default settings, and test users **only on `dev`**.
6. **Read/write split in code:** `packages/db` exports read-only query helpers for the web app.
   Mutations only go through `apps/api` handlers.

✅ Done when migrations apply cleanly to a fresh Neon `dev` branch, seed is idempotent (run twice, no
diff), and `pnpm typecheck test` pass.

---

## 4. Identity & authentication (`packages/auth`) → spike first

### 4.1 Spike, then decide (part of Checkpoint A)
Decision 0005 says **Neon Auth (managed Better Auth)** for identity, with **self-hosted Better Auth on
our Neon DB** as the fallback. Build a minimal end-to-end sign-up, sign-in, session, sign-out flow on
the single origin and check:

| Must hold | Why |
|---|---|
| Session is a **first-party cookie on our origin** (proxied or issued by our Worker) | §2 |
| We can attach our own user data (profile, roles) keyed by a stable user id | RBAC |
| Works **without sending email** (§4.4) | No domain yet |
| Password hashing doesn't blow the **Workers free CPU limit** (≈10 ms/request) | Self-hosted risk: scrypt can exceed it. Measure. Consider WebCrypto PBKDF2 or Neon-side hashing. |
| Admin plugin capabilities we need (create user, ban/deactivate, impersonation **off**) | Staff management |
| Optional TOTP 2FA available | Staff with admin rights |
| Rate limiting on auth endpoints | Abuse |

Record the result in `docs/decisions/0018-auth-implementation.md` (which option was chosen, why, and
how it was measured).

### 4.2 Users & sessions
- One identity for everyone. Staff vs member is just **roles** (§5).
- `users` (from the auth layer) + our `profiles` table: display name, first/last name, phone (optional),
  locale (`fr|en`), theme preference, `status` (`active|invited|deactivated`), `last_seen_at`.
- Session lifetime: 30 days for members, 12 h idle / 7 days max for staff with any admin permission.
  Rotate on privilege change. **Sign out everywhere** available to each user.

### 4.3 Sign-in methods (now)
- **Email + password** for staff and members.
- Google sign-in is **optional**. Ask Joël at Checkpoint A whether to enable it (free, common among
  members; needs a Google Cloud OAuth client he creates).
- Phone/SMS or WhatsApp codes: **not now** (cost per message, Phase 3+).

### 4.4 Email without a domain: the outbox (decision 0019)
There is no domain, so Brevo can't send yet (decision 0008). Implement an `EmailTransport` interface in
`packages/emails` with drivers:
- `outbox` (now): writes each message to `mail_outbox` (to, template, locale, payload, status,
  created_at). The super admin sees it in the admin (**Système → Boîte d'envoi**).
- `brevo` (later): same interface, switched by env var.

Consequences for flows:
- **Staff onboarding = invitation links.** Admin creates an invitation, the admin UI shows a single-use,
  expiring link (72 h) to copy and share (WhatsApp, in person). No email is needed.
- **Password reset for staff:** an admin with `users:manage` generates a single-use reset link the same
  way. Members can request a reset. The request lands in the outbox and the secretariat can relay it.
  Document this clearly in FR in the admin help text.
- Email verification: store `email_verified=false`. Nothing is blocked on it for now.

### 4.5 Security baseline
- CSRF protection for cookie-authenticated mutations (same-origin check + token or `SameSite` +
  `Origin` header validation, per the auth library's guidance).
- Rate limit sign-in, sign-up, reset and invite endpoints (Workers rate-limiting binding if available on
  the free plan, otherwise a small DB- or KV-backed limiter).
- Password rules: min 10 chars, check against a small common-password list, no composition rules.
- Generic error messages (no account enumeration).
- All auth pages FR/EN, on-brand, accessible.

### 4.6 Super admin bootstrap
`pnpm admin:bootstrap` (interactive CLI). It asks for the email, creates the user if missing, and
assigns the **Super admin** system role. It refuses if a super admin already exists unless `--force`
is passed together with a typed confirmation. No emails in code or config.

---

## 5. Roles, groups & permissions (RBAC)

### 5.1 Data model
```
roles            id, key (unique, slug), name_fr, name_en, description_fr/en, is_system, created_at…
permissions      key (pk, 'module:action'), module, label_fr, label_en, description_fr/en, is_dangerous
role_permissions role_id, permission_key
groups           id, key, name_fr, name_en, kind ('department'|'committee'|'choir'|'other'), description…, is_active
user_roles       id, user_id, role_id, group_id NULL (scope), granted_by, granted_at, expires_at NULL
group_members    user_id, group_id, title_fr/en NULL   ← membership ≠ permission
```
- **System roles** (seeded, `is_system=true`, not deletable, permissions editable except Super admin's):
  Super admin · Secrétariat · Éditeur · Responsable de groupe · Trésorier · Membre.
- **Super admin** implicitly has every permission, including future ones. At least one active super
  admin must always exist (enforced in API and DB constraint/trigger).
- Permissions come from **module manifests** (§6) and are upserted by the seed. Removing a permission
  from a manifest marks it `deprecated`. It is never silently deleted.

### 5.2 Checking permissions
- `packages/auth`: `can(user, 'events:publish', { groupId? })` and Hono middleware
  `requirePermission('events:publish', { group: c => c.req.param('groupId') })`.
- **Group scope:** a role granted with `group_id` applies only to resources of that group. A role
  without `group_id` is global.
- Load the user's effective permissions **once per request**, memoised.
- **Every API mutation handler** has a permission check. Write a test that walks the Hono route table
  and fails if a non-GET route lacks the middleware.
- The admin UI uses the same `can()` to hide or disable actions, but the API is the authority.

### 5.3 Audit log
- `audit_log`: id, actor_id, action (`create|update|delete|publish|login|role.grant|…`), entity_type,
  entity_id, summary_fr/en (generated), diff (JSON, **no secrets or passwords**), ip_hash (salted
  hash, not raw IP), user_agent_short, created_at.
- Helper `audit(c, {...})` used by every mutation. Logins and permission changes are always audited.
- Retention 24 months (§10.2).

### 5.4 Admin screens (all FR/EN, on-brand, built for non-technical staff)
Sidebar group **Administration** (visible only with the matching permissions):
- **Utilisateurs:**
  - list with search and filters (role, group, status)
  - invite (generates a link, §4.4)
  - detail: profile, roles with optional group scope, groups, sessions (revoke), activity from the
    audit log
  - deactivate/reactivate
  - generate reset link
- **Rôles:**
  - list
  - create/edit with a **permission matrix** grouped by module: readable labels, dangerous
    permissions flagged, "select all in module"
  - duplicate a role
  - shows how many users have each role
- **Groupes:** CRUD for departments, committees and choirs; members list; leaders (= users with
  *Responsable de groupe* scoped to that group).
- **Journal d'activité:** audit log viewer with filters (who, what, when, entity) and export CSV (super
  admin only).
- **Mon compte:** profile, password, sessions, 2FA (if enabled at Checkpoint A), language and theme.

UX rules for staff:
- plain French
- confirmations for destructive actions (type the name for dangerous ones)
- undo toasts where reversible
- illustrated empty states
- no jargon ("permission" → « droit d'accès » in the UI)
- inline help text on the role matrix

### 5.5 Protect `/_brand` and `/_ui`
These stay `noindex`/unlisted (decision 0015) and now **require a session with `system:design`**.
Anyone without it gets a normal 404. Admin `/ui` gets the same permission.

✅ **Checkpoint A** (end of §2–§4 + RBAC data model): demo on the local single origin:
- sign up as a member, invite a staff user via link, bootstrap the super admin
- sessions/cookies inspected
- auth decision 0018 written
- the Google sign-in question asked

Commit, push the branch, stop for Joël's approval.

---

## 6. Module system (`packages/modules-kit` + `modules/`)

Make the architecture's promise real (ARCHITECTURE §4):

1. Add `modules/*` to `pnpm-workspace.yaml`. Each module is a workspace package `@eec/module-<id>`.
2. `packages/modules-kit`: `defineModule()` with a typed manifest:
   - id
   - labels FR/EN
   - permissions (with labels and `dangerous`)
   - `scopedByGroup`
   - admin nav entries (group, icon, order, required permission)
   - public routes flag
   - settings schema (Zod) contributed to the Settings module
   - feature flag default
3. `modules/registry.ts`: the single list of enabled modules.
4. Consumers built **from the registry**:
   - API mounts `/api/<id>` routers
   - admin sidebar and routes, filtered by `can()`
   - permission seed
   - i18n: module messages in `modules/<id>/i18n/{fr,en}.json` merged into the Paraglide build, so
     keys stay namespaced `<id>.…`. Extend the FR/EN key-parity test to modules.
5. Feature flags in `settings_flags` (module id, enabled, updated_by). A disabled module:
   - its API returns 404
   - its admin entries are hidden
   - its public routes return 404 (on-demand) or are excluded (static)
6. Lint rule or test: a module must not import another module's internals (only its public `index.ts`).
7. Update the `new-module` skill with the real APIs once they exist (it's the reference for Phase 03).

**Phase 02 modules built on this system:** `settings`, `media`, `members`. **Core** (not a toggleable
module, always on): users, roles, groups and audit.

---

## 7. `settings` module

### 7.1 Data
- **Paroisse:**
  - official name (FR/EN)
  - short name
  - address
  - BP
  - phone(s)
  - email
  - WhatsApp (number and/or channel link)
  - socials (Facebook, YouTube…)
  - map coordinates

  All seeded with `[À VALIDER]` placeholders, **no invented values**. The research draft's details stay
  placeholders until validated (see `docs/content/README.md`).
- **Saison liturgique:** Fête des Moissons date range (start/end) and an optional manual season
  override with an expiry date. Feeds `getSeason(date, { override })` from Phase 01.
- **Fonctionnalités:** feature flags per module.
- **Système:** outbox viewer (§4.4), app version, data-retention settings (read-only display of §10.2).

### 7.2 Admin
A clean, sectioned settings page. Every field has FR/EN help. Save is per section and audited.

### 7.3 Public site consumption & freshness (decision 0021)
- The footer, contact details and season come from settings.
- **Never block page shells on the database.** Rendered on-demand pages read settings through a
  cached accessor. If Neon is cold or down, serve the last good value (stale-while-revalidate). Static
  pages read at build time.
- **Freshness without a zone:** global cache purge needs a Cloudflare zone (custom domain), which we
  don't have, and the Cache API `delete` only affects one data centre. So:
  - edge-cached responses use short TTL (60–120 s) + `stale-while-revalidate`
  - a monotonically increasing **content version** (per module), read cheaply (KV or a tiny cached
    DB read — choose and justify), is part of the cache key, so a publish is visible within seconds
    where it matters
  - document the trade-off. Revisit when a domain/zone exists (purge by URL/tag).
- Update `ARCHITECTURE.md` §6 accordingly.

---

## 8. `media` module (decision 0020)

### 8.1 Storage & serving
- R2 buckets from §1. Keys: `<kind>/<yyyy>/<mm>/<id>/<variant>.<ext>` (`kind` = `image|audio|document`).
- Public route `/media/<key>` streams from R2 via the Worker binding:
  - `Cache-Control: public, max-age=31536000, immutable` (keys are content-addressed or versioned)
  - correct `Content-Type`
  - `Range` support (audio)
  - `ETag`
  - no directory listing
- Do not use `r2.dev` public URLs in production.

### 8.2 Upload pipeline: process in the browser, not the Worker
Workers can't run `sharp` and have tight CPU limits. So images are processed **client-side in the
admin** before upload:
- decode, auto-orient, strip metadata (**remove EXIF/GPS**, a privacy requirement)
- produce **WebP** variants at 480 / 960 / 1600 w (AVIF too if the encoder is fast enough on a
  mid-range laptop; measure)
- generate a tiny placeholder (ThumbHash/BlurHash string) stored in the DB
- use well-maintained WASM/Canvas encoders (e.g. jSquash) inside a **Web Worker** so the UI stays
  responsive

Then:
- upload each variant through `/api/media` (permission `media:upload`). The API validates MIME by magic
  bytes, size limits, dimensions, and streams to R2.
- limits (configurable): image original ≤ 15 MB, audio ≤ 80 MB, PDF ≤ 20 MB
- audio and PDF are stored as-is in this phase. Speech-optimised audio processing comes with the
  sermons module.

### 8.3 Data
`media_files`: id, kind, mime, original_name, size_bytes, width, height, duration_s, variants (JSON:
key, width, size), placeholder, **alt_fr (required for images)**, alt_en, caption_fr/en, credit,
credit_url, source (`upload|pexels`), source_id, status (`ready|archived`), created_by…
`media_usages` (media_id, entity_type, entity_id, field) lets future modules register where a file is
used, so deleting in-use media is blocked or warned.

### 8.4 Admin
- **Médiathèque:**
  - grid/list with filters (kind, source, date, "unused")
  - drag-and-drop multi-upload with per-file progress and processing status
  - detail panel: preview, alt texts (required), caption, credit, usages, copy URL
  - archive/delete with usage check
- A reusable **`<MediaPicker>`** (React) for future modules: pick or upload, enforces alt text.

### 8.5 Public helper
An Astro `<Picture media={…} sizes="…">` component that renders `<picture>`/`srcset` from variants with
the placeholder as a background and lazy loading. It must respect Save-Data (smallest variant).

---

## 9. Placeholder imagery: Pexels curation into the media library
Follow the `pexels-curation` skill, now targeting the media module:
- `scripts/pexels/search.ts` (themes from the skill), with responses cached in `scripts/.cache/`
  (gitignored).
- Claude reviews thumbnails: no people, nothing off-tone, nothing Catholic-specific, no text.
- `scripts/pexels/import.ts` downloads approved originals, processes them with the same variant spec
  (Node `sharp` is fine here, since this is a local script), and inserts them into `media_files` with
  `source='pexels'`, credit and credit_url, and placeholder alt text marked `[À VALIDER]` where
  uncertain.
- Target: **24–36 images** covering the themes. Report the selection with thumbnails at Checkpoint C.
- Public credit: footer "Photos : Pexels" link + a credits page listing photographers (FR/EN).

---

## 10. `members` module (core of member accounts)

### 10.1 Public (Mon espace)
- **Sign up:**
  - first name, last name, email, password
  - optional phone
  - optional "groups I'm part of / interested in" (from `groups`)
  - **two unticked consents:** (1) required, the privacy policy (with version); (2) optional, receive
    parish news later
- Sign in, sign out, reset request (§4.4).
- **Mon espace:**
  - greeting
  - profile edit
  - language and theme
  - consents (view/withdraw optional ones, with timestamps)
  - **download my data (JSON)**
  - **delete my account** (30-day grace, then hard delete or anonymisation; audited)
  - sessions
- Placeholder cards for future member services (e.g. « Carte de Sainte-Cène — bientôt »).
- Experience: quiet, personal, warm. One small illustration on onboarding. Respect the performance
  budget: auth pages may use a small island, ordinary pages none.

### 10.2 Privacy & retention (update `docs/legal/data-protection.md`)
- `consents` table: user_id, kind, policy_version, granted_at, withdrawn_at.
- Privacy policy page FR/EN as a **draft marked `[À VALIDER]`**, versioned (`policy_version` in
  settings). Sign-up stores the version accepted.
- **Daily Cron Trigger** (Worker, not GitHub Actions) applies retention:
  - expired sessions, invites and reset tokens
  - outbox messages older than 90 days
  - accounts past the deletion grace period
  - audit entries older than 24 months
  - each run logged
- No tracking cookies, no analytics in this phase.

### 10.3 Admin
- **Membres:**
  - list with search, filters (group, joined date, status) and export CSV (permission
    `members:export`, audited, dangerous)
  - detail (read-only profile + groups + consents)
- **Tableau de bord** (admin home):
  - headcount (total members, new this month, by group)
  - simple trend chart (lightweight, tokens, both themes, accessible table fallback)
  - recent activity for super admins

---

## 11. Deployment & operations

### 11.1 First production deploy (Joël present; part of Checkpoint C)
- Single-origin deployment on `*.workers.dev` (§2), Neon `main` branch, R2 `eec-media`, secrets set
  with `wrangler secret put` / dashboard.
- **Production hygiene:**
  - `robots.txt` **disallows everything** and every page sends `X-Robots-Tag: noindex` until Joël
    decides to launch publicly (env flag `PUBLIC_LAUNCHED=false`)
  - a discreet "Version de prévisualisation" ribbon while not launched
- Security headers:
  - CSP (no third-party origins, `frame-ancestors 'none'`, YouTube allowed only where needed later)
  - HSTS
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` minimal
  - `X-Content-Type-Options`

### 11.2 Workflows (update `docs/ops/ci-cd.md` with a line per workflow)
- `deploy.yml`: on push to `main`, **path-filtered**, deploys only affected Workers (Turbo
  `--affected`). Runs migrations **only** when `packages/db/migrations/**` changed, creating a Neon
  backup branch first. Concurrency group `deploy-prod`, no cancel mid-deploy.
- `preview.yml`: `workflow_dispatch` only, deploys to a preview Worker name against Neon `dev`.
- `backup.yml`: **weekly** schedule + manual. `pg_dump` of Neon `main` → compressed, encrypted with an
  age/GPG key whose private half Joël keeps offline → R2 `eec-backups`, keeping 8 weekly copies. Reason:
  the Neon free plan keeps only ~6 h of history. Joël periodically copies one to Google Drive
  (archive, decision 0006). Document the restore procedure and **test a restore** to a scratch Neon
  branch once.
- No other schedules in GitHub. Retention runs as a Cloudflare Cron Trigger.

### 11.3 Docs
- `docs/ops/runbook.md`: environments, how to deploy, rotate secrets, run migrations, restore a backup,
  add a staff user, what to do when Neon is asleep or over quota.
- `docs/ops/incident.md`: data-breach procedure per Loi n°2024/017. Contain, assess, notify the APDP
  and affected people, record.

✅ **Checkpoint B** (after §5.4, §6, §7): demo the admin.
- Joël logs in as super admin, creates a custom role with the matrix, scopes a *Responsable de groupe*
  to JAPE, toggles a feature flag, edits settings and sees them on the public footer, reads the audit
  log.
- Show the module registry in action.

Stop for approval.

✅ **Checkpoint C** (after §8–§11): demo the rest.
- media upload in the browser (variants, EXIF stripped, alt required)
- the Pexels selection
- member sign-up → Mon espace → export → delete
- headcount dashboard
- first production deploy on workers.dev (noindex)
- backup + restore test

Stop for approval before merging.

---

## 12. Quality gates (before Checkpoint C)
- **Security:**
  - route-table test (every mutation guarded)
  - auth endpoints rate-limited
  - CSRF verified
  - no secrets in git (`git grep` for key patterns)
  - security headers present
  - EXIF stripped (test with a GPS-tagged sample)
- **Permissions tests:**
  - matrix tests for system roles
  - group-scope tests (JAPE leader can't edit UFC)
  - last-super-admin protection
- **Budgets:** public pages still within Phase 01 budgets. The member pages' island is reported
  (target ≤ 60 KB gz). Admin initial JS reported (target ≤ 250 KB gz, routes code-split).
- **Accessibility:** keyboard pass on auth forms, role matrix, media library, member space. Screen
  reader labels on the matrix checkboxes ("Éditeur — Actualités — Publier").
- **i18n:** FR/EN parity test passes, including modules. No hard-coded strings.
- **Resilience:** with the DB unreachable, public static pages still render, and on-demand pages serve
  cached/stale settings or a graceful fallback (no 500 on the home page).
- `pnpm check` green.

---

## 13. Wrap-up
1. Decision records: 0017 single origin · 0018 auth implementation · 0019 email outbox · 0020 media
   pipeline · 0021 cache freshness · 0022 backups. Update `docs/decisions/README.md`.
2. Update `ARCHITECTURE.md`, `docs/legal/data-protection.md`, `docs/ops/ci-cd.md`, the `new-module`
   skill, and `/_brand` (document every new component: matrix, media picker, picture, auth forms,
   dashboard stat tiles).
3. `STATUS.md`: Phase 02 done, Phase 03 next (content modules: pages, news, events, liturgy, schedule,
   departments, guides, contact, giving, legal).
4. `docs/phases/PHASE_02_REPORT.md`:
   - what was built
   - decisions and measurements (auth CPU timing, bundle sizes, cold-start behaviour)
   - deviations and why
   - known issues
   - suggestions for Phase 03
5. PR `feat/phase-02-platform-core → main`, ready for review, with screenshots.

---

## Out of scope (Phase 03+)
Content modules (news, events, liturgy content, schedule, departments, guides, contact, giving page),
story pages and GSAP narratives, newsletter and real email sending (needs domain), payments (pawaPay),
sermons/audio processing, PWA, analytics, phone/SMS login, sacrament records.

## Commit conventions
Conventional Commits, scoped (`feat(auth): …`, `feat(rbac): …`, `feat(media): …`, `chore(db): …`,
`ci: …`). Migrations get their own commits (`chore(db): add rbac tables`). Push at checkpoints only.

## Stop and ask Joël when
- an account, secret or payment method is needed
- the auth spike fails one of the "must hold" rows
- a free-tier limit would be exceeded or a cost would appear
- a dependency isn't covered by the docs
- any data field beyond what's listed here
- anything about the parish stated as fact
- before the first production deploy
- before any destructive migration
