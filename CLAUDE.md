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
Google Drive (archive only) · outbox now, Brevo later (0019) · Tailwind v4 · GSAP · Hugeicons stroke-rounded · Switzer + Erode (0023).
pnpm workspaces + Turborepo.

## How to work

- New feature → use the `new-module` skill. Features live in `modules/<name>/`, never scattered.
- UI work → `design-system` skill. Animation → `gsap-motion`. Illustrations → `svg-illustration`.
  Emails → `email-templates`. Copy → `i18n-content`. Stock photos → `pexels-curation`.
  Before a release → `release-checklist`.
- Icons: Hugeicons **stroke-rounded only** (`@hugeicons/core-free-icons`). No other icon set.
- **Document as you build:** every new component, pattern, animation, transition or token is documented
  in the living guide (`apps/web` → `/fr/_brand`, `/en/_brand`) in the same change. No entry = not done.
- Keep `STATUS.md` updated at the end of each working session (what changed, what's next).
- Commits: Conventional Commits (`feat(events): …`, `fix(web): …`, `docs: …`). Small and focused.
- Prefer editing existing docs over creating new ones. All documentation lives in `docs/`, except the
  root files (README, CLAUDE, ARCHITECTURE, STATUS).

## Commands (once scaffolded)

```bash
pnpm install
pnpm dev            # all apps
pnpm dev --filter web|admin|api
pnpm lint && pnpm typecheck && pnpm test
pnpm db:generate && pnpm db:migrate
```
