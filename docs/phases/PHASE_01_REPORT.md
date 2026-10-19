# Phase 01 — Report

Brand & Foundations · branch `feat/phase-01-foundations` · 2026-10-19

## What was built
- **Monorepo:** pnpm 12.14 + Turborepo 2.11, Biome 2.5, Vitest 5, TypeScript 6.0 (strict), Node 24 LTS
  (`engines ≥ 22.22`). Apps: `web` (Astro 7, static + one on-demand `/` redirect), `admin` (Vite 8 + React
  19 + TanStack Router/Query), `api` (Hono, `GET /health`). Packages: `ui`, `i18n`, `core`, `config`, `scripts`.
- **CI:** `.github/workflows/check.yml` exactly per `docs/ops/ci-cd.md` (ready PRs to `main`, code paths
  only, concurrency cancel, pnpm + Turbo cache, `--affected`), plus a cached Fontshare fetch. No deploy workflow.
- **Brand:** EEC mark redrawn as SVG from the official PNG (yellow/green overlap 98.9 %, tools in
  `scripts/brand-trace`), variants full / mark / mono / halo, favicons and app icons, responsive live-text
  lockup, **Fraunces + Switzer**, palette + state colours + nine seasons, original illustration (1.6 KB gz).
- **Tokens:** generated from `packages/ui/src/tokens.ts` → `tokens.css` (Tailwind `@theme`, both themes,
  seasons, skin tones, fluid type, motion with reduced-motion values). `pnpm contrast`: 158 pairs, 0 failing.
- **Primitives:** one stylesheet; Astro components on native elements + 2 KB of vanilla TS; React on Base UI.
  Button, Field/Input/Textarea/Select, Combobox (admin), Checkbox/Radio/Switch, Menu, Popover, Tooltip,
  Dialog, Sheet, Tabs, Accordion, Toast, Card, Badge, Avatar, Skeleton, Empty state, Verse, Ornament.
- **Public shell:** header (mega-panels, hover intent 120 ms, keyboard, hide/show on scroll, blur), mobile
  full-screen sheet with clip-path reveal, footer, page-turn transitions (fade under reduced motion), 22
  localised placeholder pages × 2 languages with a slug map, home (season-aware), 404, `robots.txt`,
  sitemap (internal pages excluded), hreflang, canonical, OG basics.
- **Admin shell:** collapsible sidebar by groups, top bar (language, theme, account menu), ⌘K palette, login
  UI (validation, no auth), `/ui` components gallery, bilingual, same tokens and fonts.
- **Living guide:** `/fr/_brand` and `/en/_brand` — brand guidelines (identity, voice and tone), logo, colour,
  type, shape, motion, icons, illustration, every component, rules. Rule: document in the same change.
- **Other:** liturgical season util (computus, Africa/Douala, tests 2024–2030), FR/EN messages with French
  typography helper, design-rules check in `pnpm lint` (no one-sided borders, no squircles).

## Round 2 (after Joël's review)
Floating navigation everywhere (site header, admin sidebar and top bar, sheets); mega menus with an icon on
every entry and an original illustration per menu; lockups on one, two (EEC / Paroisse de Nkolndongo 1) or
three lines; line-art preloader; custom select list that matches the Actions menu; circular-ornament loader
that keeps the label; sliding elastic tab indicator and hover tint; gentler accordion and nav motion; stacked
toasts with a progress ring and a tone-tinted close; the quote (`Verse`) straddling its edge with ornaments;
rounded, auto-hiding scrollbars; consistent avatar; dark terminal-style admin favicon; brand-guide sidebar with
a title, scrollspy and nested sections; real copy on every page (no invented facts: addresses, times and names
stay as clear "coming soon" notes).

## Budgets (measured on the production build)
| Page | JS (gz) | Total first load | LCP* | CLS | 3rd-party |
|---|---|---|---|---|---|
| `/fr/` (home) | 7.6 KB | 168 KB (fonts 119) | 1.5 s | 0.000 | 0 |
| `/fr/decouvrir/ce-que-nous-croyons/` | 7.6 KB | 168 KB | 1.4 s | 0.039 | 0 |
| `/404` | 2.2 KB | 96 KB | 1.0 s | 0.000 | 0 |
\*Mobile profile: 4× CPU slowdown, 1.6 Mbps / 150 ms. Lighthouse mobile (simulated, measured before round 2): **home 96 / 100 / 100 /
100**, placeholder **95 / 100 / 100 / 100** — re-run before release (performance / accessibility / best practices / SEO).
Admin (behind login, outside the public budget): ≈ 245 KB JS gz. `/_brand` is internal and heavier (≈ 600 KB
before the overlay image was shrunk from 386 KB to 42 KB).

## Quality gates
`pnpm lint typecheck test build` green (22 tasks). Keyboard checks done in a real browser: header panels
(open, arrows, Esc, focus return), mobile menu (Esc), dialog (open, Esc, focus return), admin palette
(Ctrl+K, filter, Enter navigates). No horizontal overflow at 320/375 px; zero console errors; zero
third-party requests. Screenshots (FR/EN, light/dark, 375/1440): `scripts/.cache/shots/final/` (not committed).
**Not done:** a screen-reader (TalkBack) pass — to run before the first release.

## Deviations from the instructions (and why)
- **Fonts:** Fontshare's licence forbids subsetting and committing the files, so Switzer is **fetched at
  build** (`pnpm fonts:fetch`, cached in CI) and served unmodified; only Fraunces (OFL) is committed (0015).
- **Display font:** Fraunces + Switzer, after testing General Sans; Zodiak/Gambetta dropped.
- **TypeScript 6.0.3**, not 7: `@astrojs/check` doesn't support 7 yet.
- **Gallery:** components are documented in `/_brand` (Joël's request) instead of a separate `/fr/_ui`; the
  admin keeps its own `/ui` for the React primitives.
- **Admin i18n** uses a small provider over the same `createT` rather than Paraglide's runtime strategies.
- **Base UI** instead of Radix (decision 0016); `sharp` and `svgo` added as script-only dev dependencies.
- **Lockups** are live text (Fraunces), not outlined vectors, so they stay responsive and translatable.
- Added beyond the brief: design-rules lint, state colours, `Verse` and `Ornament`, `Lockup`.

## Known issues / to confirm
- `/_brand` is **unlisted, not private** (noindex, unlinked): protect it with auth in Phase 02.
- The season is computed **at build time**: it won't change between builds (compute client-side or rebuild
  monthly); `moissons` needs the admin date range.
- Season conventions to confirm: Épiphanie ends the Sunday after 6 Jan; Pentecôte lasts one week;
  Épiphanie = gold and Semaine sainte = crimson (proposed).
- The brand-voice and identity text is a proposal for the Parish Council to review.
- Search button is a disabled placeholder; "Mon espace" and the login are UI only.
- Facts shown as `[À VALIDER]`: tagline, address, hours, social links, photo credits, page contents.
- `.dev` needs the Fontshare download on first run (network); without it, system fonts are used.

## Suggestions for Phase 02
1. Neon + Drizzle + Neon Auth + RBAC; put `/_brand` behind a role.
2. First modules: settings (parish, season override, Moissons range), media (R2), news, events.
3. Search (Pagefind or Postgres FTS), the "Ce dimanche" card, the real header "next event" highlight.
4. Deploy workflows (path-filtered), Cloudflare cache purge on publish, a manual Lighthouse script in
   `release-checklist`.
5. Replace placeholder pages module by module, with real photos (Pexels curation meanwhile).
