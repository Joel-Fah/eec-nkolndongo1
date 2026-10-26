# CLAUDE.md — working rules for this repo

You are the engineering partner on the EEC Nkolndongo 1 website. Joël Fah is the product owner,
super admin and (for now) the only developer. Read this file, then `STATUS.md`, before any task.

## Mindset

- **Useful before impressive.** Every feature, animation and dependency must earn its place for real
  parishioners on mid-range Android phones and paid mobile data in Yaoundé.
- **Experience matters.** Each public page is a crafted experience (see `docs/product/pages.md`),
  but never at the cost of speed, accessibility or clarity.
- **Settle, then build.** Non-trivial choices get a short decision record in `docs/decisions/`.
- When Joël is off on a technical point, say so plainly and propose the better path.

## Non-negotiables

1. **French first.** Write FR strings first, then EN. No hard-coded user-facing text — everything goes
   through `packages/i18n`. Both the public site and the admin are bilingual.
2. **Light + dark themes** through design tokens only. No raw hex/px values in components.
   **Never a one-sided border** (no `border-t/b/s/e/l/r`, no side rule on quotes): separate with space, a
   tint, a full frame or `<Ornament>`. Enforced by `pnpm lint`.
3. **Performance budget** (public site, per page, 4G mobile): ≤ 100 KB JS (compressed), ≤ 250 KB total on
   first load excluding lazy media, LCP < 2.5 s. GSAP is loaded only on pages that use it.
4. **Accessibility:** WCAG 2.2 AA. Keyboard reachable, visible focus, `prefers-reduced-motion` respected,
   contrast checked in both themes.
5. **Data protection (Loi n°2024/017, Cameroun):** collect the minimum, explicit opt-in consent (never
   pre-ticked), no sensitive pastoral records without an approved decision record. See `docs/legal/`.
6. **Secrets never in git.** The repo is public. Use `.dev.vars` / `.env.local` (gitignored) and
   Cloudflare/GitHub secrets.
7. **Content is not truth until validated.** Anything under `docs/content/` marked `À VALIDER` must not
   ship as fact. Never invent names, dates, times or quotes about the parish.
8. **CI is frugal.** Don't add workflows or triggers without reading `docs/ops/ci-cd.md`.

## Stack at a glance (details in ARCHITECTURE.md)

Astro (public) · Vite + React + TanStack (admin) · Hono on Cloudflare Workers (API) · Neon Postgres +
self-hosted Better Auth (0018) · Drizzle · S3-compatible bucket: Neon Object Storage now, R2 later (0020) · YouTube (video) ·
Google Drive (archive only) · outbox now, Brevo later (0019) · hand-written PWA service worker (0037, amended by 0050) · in-app notifications (0044) · Tailwind v4 · GSAP · Hugeicons stroke-rounded · Switzer + Erode (0023).
pnpm workspaces + Turborepo.

## How to work

- New feature → use the `new-module` skill. Features live in `modules/<name>/`, never scattered.
- UI work → `design-system` skill. Animation → `gsap-motion`. Illustrations → `svg-illustration`.
  Emails → `email-templates`. Copy → `i18n-content`. Stock photos → `pexels-curation`.
  Before a release → `release-checklist`. New route, upload, personal data or third-party call → `owasp-security`.
- Icons: Hugeicons **stroke-rounded only** (`@hugeicons/core-free-icons`). No other icon set.
- **Document as you build:** every new component, pattern, animation, transition or token is documented
  in the living guide (`apps/web` → `/fr/_brand`, `/en/_brand`) in the same change. No entry = not done.
- Keep `STATUS.md` updated at the end of each working session (what changed, what's next).
- Commits: Conventional Commits (`feat(events): …`, `fix(web): …`, `docs: …`). Small and focused.
- Prefer editing existing docs over creating new ones. All documentation lives in `docs/`, except the
  root files (README, CLAUDE, ARCHITECTURE, STATUS).

## Commands

```bash
pnpm install
pnpm dev            # gateway :8080 + site + admin (pnpm dev:stop frees the ports; if the site fails to start in 30 s, stop and retry)
pnpm check          # lint + typecheck + tests for everything (use --concurrency=2)
pnpm e2e            # manual end-to-end checks against the LOCAL stack only
pnpm db:generate && pnpm db:migrate     # migrations: additive, own commit, dev branch only unless Joël says so
pnpm db:seed        # roles, settings (production: only on Joël's go)
pnpm bible:seed · pnpm content:pending · pnpm build:site
pnpm --filter @eec/i18n build           # after editing any messages/*.json (compiles the messages; a missing key crashes the screen)
pnpm --filter @eec/scripts og:generate | brand:icons | jsonld:check | social:kit
```

## Rules learned the hard way

- Anything private (Mon espace, photos, notifications, member-only pages) is `private, no-store`, `noindex`, and in the service worker's private list.
- Figures that wait for validation (0045) count nowhere; a person cannot validate their own entry.
- Modules never import each other: cross-module data is read by table name; `modules/scope.test.ts` and the route-table test must stay green.
- System-role grants are **offered once** by the seed (decision 0048): after adding a permission, run `pnpm db:seed` on each environment; a grant removed on purpose in Rôles never comes back. Tell Joël what a new role needs.
- A person waiting (a join request, a card proposed) is **never** counted as a member or a holder: keep them in their own table or status.
- Anything that reveals a belief (baptism, confirmation, the card) is sensitive: explicit acknowledgement, restricted access, erased with the account (0050).
- Help for an admin screen lives in the top-bar help sheet (`apps/admin/help/<lang>/<slug>.md` + `GUIDES` in `apps/admin/src/lib/help.ts`), never inline on the page.
- Production is Joël's: no deploy, migration, seed, secret, role grant or merge to `main` without his explicit OK. Never set `SITE_INDEXABLE=1`.
