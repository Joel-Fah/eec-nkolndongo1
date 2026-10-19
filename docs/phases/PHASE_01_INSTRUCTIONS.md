# Phase 01 — Brand & Foundations

> **Goal:** a working monorepo with the brand, design tokens, UI primitives and the public site shell
> (header, 5-tab navigation, footer, themes, languages), all on-brand and within budget.
> No database, no auth, no content modules yet — those are Phase 02.

| | |
|---|---|
| Owner | Joël Fah (product owner, approves checkpoints) |
| Builder | Claude Code |
| Branch | `feat/phase-01-foundations` |
| Depends on | Phase 00 framing (done — see `STATUS.md`) |
| Checkpoints | **A** after the brand board · **B** after primitives + site shell |

---

## 0. Read first (mandatory)

1. `CLAUDE.md` — rules. `STATUS.md` — state.
2. `ARCHITECTURE.md` — stack, layout, modules.
3. `docs/design/design-language.md` and `docs/design/illustration-guide.md`.
4. `docs/product/navigation.md` and `docs/product/pages.md`.
5. `docs/ops/ci-cd.md`.
6. Skills in `.claude/skills/`: `design-system`, `svg-illustration`, `gsap-motion`, `i18n-content`.

If anything in this file contradicts those docs, **stop and ask Joël**; don't silently pick one.

---

## 1. Pre-flight & repo housekeeping

1. If a folder `_claude/` exists at the repo root, rename it to `.claude/` (it was written by a tool that
   could not write dot-folders). Merge if `.claude/` already exists.
2. Delete the duplicate `eec-logo-tr.png` at the repo root (the source of truth is
   `assets/images/eec-logo-tr.png`). Confirm both files are identical first (hash).
3. Git:
   - If the folder isn't a git repo yet: `git init -b main`, add remote
     `https://github.com/Joel-Fah/eec-nkolndongo1.git`, `git fetch`, `git reset origin/main`
     (keeps local files, adopts the remote history that contains `LICENSE`).
   - Commit the existing docs on `main` (`docs: project framing, architecture, decisions and Claude skills`)
     if not already committed. Ask Joël before the first push.
   - Create `feat/phase-01-foundations` for all work below.
4. Toolchain: Node **22 LTS or newer**, pnpm via `corepack enable`. Record versions in `.nvmrc` and
   `packageManager` field.

✅ Done when: clean `git status`, branch created, `.claude/skills/*/SKILL.md` present (8 skills).

---

## 2. Monorepo scaffold

Use the **latest stable** versions at the time of building; pin exact versions in `package.json`.

```
apps/web        Astro + @astrojs/cloudflare + Tailwind v4 (@tailwindcss/vite)
apps/admin      Vite + React 19 + TypeScript + TanStack Router (file-based) + TanStack Query + Tailwind v4
apps/api        Hono on Cloudflare Workers (wrangler) — only GET /health in this phase
packages/ui     tokens.css, Tailwind @theme, fonts, brand SVGs, icons wrapper, styles, React primitives
packages/i18n   FR/EN messages + helpers (frTypo, formatters)
packages/core   framework-free utilities (liturgical calendar, dates, slugs) + tests
packages/config shared tsconfig, Biome config
```

Requirements:
- **pnpm workspaces + Turborepo**. Root scripts: `dev`, `build`, `lint`, `format`, `typecheck`, `test`.
- **TypeScript strict** everywhere, path aliases via workspace packages (no deep relative imports across packages).
- **Biome** for lint + format (one fast tool) + `astro check` for Astro files. Write decision record
  `docs/decisions/0013-biome.md`.
- **Vitest** for unit tests.
- **i18n library: Paraglide JS (inlang)** — compiled, tree-shaken messages usable from both Astro and
  React. FR is the base locale. Write `docs/decisions/0014-paraglide-i18n.md`. If Paraglide's current
  version doesn't integrate cleanly with Astro i18n routing, stop and propose an alternative.
- Astro i18n routing: `defaultLocale: 'fr'`, `locales: ['fr','en']`, **prefix both** (`/fr/…`, `/en/…`);
  `/` redirects by `Accept-Language`, falling back to `/fr/`.
- Admin is bilingual too (same message source, locale switcher in its top bar).
- `.env.example` files where env vars will exist (none needed yet besides placeholders). No secrets in git.
- Add `.github/workflows/check.yml` **exactly per `docs/ops/ci-cd.md`**: `pull_request` to `main`,
  types `[opened, synchronize, reopened, ready_for_review]`, skip drafts (`if: !github.event.pull_request.draft`),
  `paths-ignore` docs/markdown/references, `concurrency` with `cancel-in-progress`, pnpm + Turbo cache,
  runs `lint typecheck test build` with `--affected` where possible. **No deploy workflow in this phase.**

✅ Done when: `pnpm i && pnpm dev` starts all three apps; `pnpm lint typecheck test build` passes.

---

## 3. Brand board → **Checkpoint A**

Build a non-indexed page in `apps/web` at `/fr/_brand` (and `/en/_brand`), `noindex`, excluded from the
sitemap. It uses provisional tokens and must show:

### 3.1 Logo (SVG redraw)
- Redraw the EEC mark from `assets/images/eec-logo-tr.png` as clean, hand-optimised SVG.
  Suggested method: auto-trace (e.g. `potrace`) as a *starting point only*, then rebuild with clean
  paths (minimal nodes, exact horizontals/verticals on the cross, consistent outline width).
- Faithfulness check: overlay the SVG on the PNG at 50% opacity on the brand board (toggle) — shapes,
  proportions and colours must match. The official mark is **not redesigned**.
- Variants in `packages/ui/brand/`:
  - `mark-full.svg` (with "Eglise Evangélique du Cameroun" arc text — text converted to paths)
  - `mark.svg` (without the embedded text)
  - `mark-mono.svg` (single colour, `currentColor`)
  - Dark-background treatment: the white cross and black outlines must remain legible on `--bg` dark
    (propose: keep outlines, add a subtle light halo or use the mono variant — show options).
- Lockups (horizontal), each in light / dark / mono:
  - **Short:** mark + `EEC NKOLNDONGO 1`
  - **Long:** mark + `Église Évangélique du Cameroun` / `Paroisse de Nkolndongo 1` (two lines)
  - Show type options for the wordmark with each display-font candidate; clear-space and minimum-size
    rules drawn on the board.
- Favicons/app icons generated from `mark.svg`: `favicon.svg` (with dark-mode media query), 32px ICO
  fallback, 180px apple-touch, 192/512 maskable PNG.

### 3.2 Colour
- Swatches for every token in `design-language.md` §2, light and dark, plus season accents.
- Script `scripts/contrast-check.ts` that computes WCAG contrast for all text/background pairs in both
  themes and prints a table; the board displays the results. Adjust values that fail AA and note the
  change in `design-language.md`.

### 3.3 Typography
- Self-host **Switzer** (Fontshare) for text/UI. Display candidates: **Fraunces** (Google Fonts, OFL),
  **Zodiak** and **Gambetta** (Fontshare). Download from the official sources; if a download is blocked,
  ask Joël to drop the files in `assets/fonts/`.
- Subset to Latin + French characters (`pyftsubset`/`glyphhanger`), WOFF2, variable where available.
  Commit licence files next to fonts. `font-display: swap`, preload only the body text font + one display weight.
- Specimen for each pairing: H1–H4, lead, body, small, button, nav, a French paragraph with « » and
  `: ; ! ?` spacing, numbers/dates (`dimanche 25 octobre · 09h00`, `5 000 FCFA`).

### 3.4 Shape, elevation, motion
- Radius scale (6/10/14/20/28) on real elements; concentric-radius example.
- Shadow levels 1–3 in light; dark elevation treatment.
- Motion tokens demo: micro / UI / narrative durations and easings (CSS), reduced-motion behaviour.

### 3.5 Icons & illustration
- Hugeicons stroke-rounded sample grid (~24 icons we'll actually use: home, calendar, church, book,
  music, users, heart/hand, phone, map pin, mail, search, globe, sun/moon, menu, close, arrows, play,
  download, share, WhatsApp-like chat, money/gift, info, check, alert).
- **One original sample illustration** following `svg-illustration`: *"Hands passing a hymn book"*
  (empty state / welcome banner), using tokens + 4 skin tones, ≤ 15 KB gz, with a subtle GSAP idle
  animation (reduced-motion aware). Shown in light, dark and two season accents.

### Checkpoint A — stop here
Commit, push the branch, and give Joël:
- the local URL of the brand board, screenshots (light + dark, desktop + mobile 375px),
- the 3 type pairings with your recommendation and why,
- any token changes from the contrast check,
- open questions.
**Do not continue until Joël approves** the logo redraw, lockups, display font and palette.
Then record `docs/decisions/0015-brand-and-type.md`.

---

## 4. Design tokens (final)

- `packages/ui/tokens.css`: all tokens as CSS custom properties under `:root` / `[data-theme="dark"]`,
  plus `@media (prefers-color-scheme: dark)` for `:root:not([data-theme])`.
- `--season` set via `[data-season="avent|noel|epiphanie|careme|semaine-sainte|paques|pentecote|ordinaire|moissons"]`.
- Tailwind v4 `@theme` mapping tokens → utilities (colours, radius, shadow, font, ease, duration).
  Components must use these utilities/vars only.
- Skin tones `--skin-1..4` for illustrations.
- Fluid type scale with `clamp()`.
- **Theme handling:** tiny inline script in `<head>` (no flash) reads saved preference (wrapped in
  try/catch), else system. Toggle cycles system → light → dark; persisted per browser.
- **Liturgical season util** in `packages/core/liturgy.ts`: `getSeason(date, tz='Africa/Douala')`
  computing Advent (4 Sundays before Christmas), Christmas, Epiphany, Lent (Ash Wednesday = Easter −46),
  Holy Week, Easter (computus — Anonymous Gregorian algorithm) → Pentecost (+49), Ordinary time.
  `moissons` is **not** computed — it's an admin-set date range later; accept an optional override.
  Unit tests for at least 2025–2030 known Easter dates and boundary days. The web layout sets
  `data-season` from it at build/render time.

---

## 5. UI primitives

Two consumers with different budgets:

| Consumer | Approach |
|---|---|
| **Admin** (React) | React components on **Radix UI** (or Base UI) primitives, styled with tokens, in `packages/ui/react` |
| **Public site** (Astro) | **Astro components + small vanilla TS**, using native platform features (`<dialog>`, `popover` attribute, `<details>`) — **no React runtime on ordinary pages**. React islands only for complex widgets later (quiz, dial). |

Both share the **same CSS** (`packages/ui/styles/*.css`) so they look identical. Write
`docs/decisions/0016-dual-primitives.md`.

Build, in both flavours unless marked:
Button (primary / secondary / ghost / link; sizes sm/md/lg; loading; icon-only) · Input · Textarea ·
Select (public: styled native; admin: Radix Select) · Combobox (admin) · Checkbox · Radio · Switch ·
Dropdown menu · Popover · Tooltip · Dialog · Sheet (side/bottom) · Tabs · Accordion · Toast · Card ·
Badge · Avatar · Skeleton · Empty state (with illustration slot) · Field (label + hint + error wrapper).

Each must handle: hover, active, **focus-visible (gold ring)**, disabled, error, loading where relevant;
keyboard support (arrows in menus/tabs, Esc closes, focus trap in dialog/sheet, focus return);
44px touch targets; FR/EN labels; light/dark; reduced motion.
Shapes per `design-language.md` §3 — **rounded Apple-like, no pills, no squircles**.

Gallery pages (noindex):
- Public: `/fr/_ui` — every Astro primitive, all states, both themes side by side.
- Admin: `/ui` route — every React primitive, same.

---

## 6. Public site shell

- **Header**: logo lockup (short on mobile, long on ≥ 1024px if it fits — test), 5 tabs from
  `navigation.md` with dropdown mega-panels (short description per link, hover-intent ≈120 ms, click and
  keyboard open, Esc closes, arrow-key navigation), utilities: search (button only for now), FR/EN
  switcher (keeps the equivalent page via a slug map), theme toggle, "Mon espace" (links to a
  placeholder). Hide-on-scroll-down / show-on-scroll-up; translucent with backdrop blur over heroes.
- **Mobile menu**: full-screen sheet, tabs as accordions, utilities at the bottom, soft clip-path reveal,
  focus trap, thumb-reachable close.
- **Footer**: address `[À VALIDER]`, hours placeholder, socials placeholders, legal links, "Photos : Pexels"
  credit slot, language + theme controls.
- **Page transitions**: Astro View Transitions with a gentle page-turn feel; reduced-motion = crossfade.
- **Placeholder pages** for every nav destination in FR and EN with localised slugs, each showing a
  tasteful "Bientôt / Coming soon" empty state (uses the sample illustration) — so navigation is fully
  testable. **No invented parish facts**; use `[À VALIDER: …]` markers where text needs real data.
- **Home placeholder**: hero with season-aware accent + headline placeholder; nothing else yet.
- **404** page (FR/EN) with a simple temporary illustration slot.
- SEO basics: `<html lang>`, `hreflang` alternates, canonical, OG defaults, `robots.txt`, sitemap (exclude `_` pages).

---

## 7. Admin shell (minimal)

- Layout: collapsible sidebar (groups from `navigation.md` admin section, items as placeholders),
  top bar (locale switcher, theme toggle, user menu placeholder), content area.
- Command palette shell (⌘K / Ctrl+K) listing the placeholder routes.
- Login screen **UI only** (no auth logic — Phase 02), on-brand, FR/EN.
- Same tokens/fonts as the public site.

---

## 8. Budgets & quality gates (must pass before Checkpoint B)

- Public pages: **JS ≤ 100 KB gz** (shell pages should be far below — report actual), first load
  ≤ 250 KB excluding lazy media, LCP < 2.5 s and CLS < 0.05 on throttled 4G mobile.
- **Zero third-party requests** on public pages (fonts, icons, images self-hosted).
- Lighthouse mobile on `/fr/` and one placeholder page: Performance ≥ 90, Accessibility 100.
- Keyboard-only walkthrough of header, dropdowns, mobile menu, dialog, admin sidebar and palette.
- Light/dark and FR/EN screenshots at 375px and 1440px for: home, one placeholder, 404, `_ui`, admin `/ui`, admin login.
- `pnpm lint typecheck test build` green. Contrast script green.

---

## 9. Checkpoint B — wrap-up

1. Update docs: `ARCHITECTURE.md` (anything that changed), `design-language.md` (final tokens),
   `docs/decisions/README.md` (0013–0016), `STATUS.md` (phase 01 done, phase 02 next).
2. Write `docs/phases/PHASE_01_REPORT.md`: what was built, budgets measured, deviations from this
   file and why, known issues, suggestions for Phase 02.
3. Push and open a PR `feat/phase-01-foundations → main` (ready for review — this will run the check
   workflow once). Summarise for Joël with screenshots.

---

## Out of scope (Phase 02+)
Database (Neon/Drizzle), auth (Neon Auth) and RBAC, settings & media modules, R2, content modules,
Pexels curation, deploy workflows, domain, email. Don't start them — note ideas in the report.

## Commit conventions
Conventional Commits, small and focused, one logical step each (e.g. `chore: scaffold monorepo`,
`feat(ui): add design tokens`, `feat(brand): redraw EEC mark as SVG`, `feat(web): header and navigation`).
Push only at checkpoints (keeps CI quiet; drafts don't run CI anyway).

## When to stop and ask Joël
- Any contradiction between docs; a needed tool/download is blocked; a budget can't be met;
  a dependency choice not listed here; anything touching the official logo's shapes;
  any wording that states a fact about the parish.
