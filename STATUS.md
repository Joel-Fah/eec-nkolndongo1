# STATUS

_Last updated: 2026-10-19_

## Current phase: 02 — Platform Core (Checkpoint A done) + public UI revamp in review

## In progress — public UI revamp (asked by Joël, 2026-10-19)
Joël rejected the Phase 01 page layouts. Direction: SaaS-sleek (Supabase/Neon feel) for a church, each
page with its own concept. Vertical slice done, **waiting for Joël's review** before rolling out to every page:
- Erode replaces Fraunces (decision 0023); fields: required placeholders, stronger focus state.
- Preloader: small centred badge, the mark drawn as line art then filled; the page waits for it.
- Floating footer (invitation, site map, cropped « Nkolndongo »).
- Home: card stream hero (pause button), key figures (`lib/stats.ts`, null until validated), bento grid,
  season ring. Mon espace: one card, two tabs, three-step sign-up, member dashboard.
- First Cuate-style illustration `sunday-welcome` (Joël judges it before more are drawn).
- Pexels photos of people: **dev-only** placeholders (gitignored, removed from builds; credits in
  `apps/web/src/content/placeholders.json`). Real, consented parish photos needed before launch.
- Next after review: every other page gets its own concept (`docs/product/pages.md`), then Checkpoint B.

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
