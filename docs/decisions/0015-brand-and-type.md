# 0015 — Brand and type
**Status:** Accepted · 2026-10-19 (approved by Joël at Checkpoint A)

## Logo
The mark is redrawn as SVG from the official PNG (`packages/ui/brand/`, method in
`scripts/brand-trace/README.md`): shapes, proportions and colours unchanged (overlap 98.9 %).
The top arm of the cross stays slightly wider than the shaft, as in the original.
Variants: `mark-full` (with arc text), `mark`, `mark-mono`, `mark-halo`. On dark backgrounds:
**B, the cream halo** for the header and large sizes, **C, cream line art** for one-colour or small uses.
Minimum size: 24 px tall without text, 200 px with the arc text.

## Lockups
« EEC NKOLNDONGO 1 » (short) and « Église Évangélique du Cameroun / Paroisse de Nkolndongo 1 » (long),
in **live text** (Fraunces), not outlined, so they stay crisp, translatable and responsive.
`<Lockup variant="auto">` picks short or long from the width its slot offers (container query,
22 rem). The "1" is preceded by a no-break space so it never wraps alone.

## Typography
- **Headings, lockups, big numbers: Fraunces** (SIL OFL; subset, opsz 72, SOFT 50, WONK 1, weights
  300–700, 34 KB + 43 KB italic). **Text and UI: Switzer** (Fontshare, variable, 42 KB, unmodified).
  Joël chose this after trying serif + sans against Switzer + General Sans: the Switzer + Fraunces
  pairing gives the contrast between warm display and calm reading. Zodiak, Gambetta, General Sans
  and Geist were dropped (Geist is excluded by `CLAUDE.md`).
- The layout preloads Switzer; Fraunces loads only where headings need it. Metric-matched fallbacks
  (Arial/Roboto, Georgia/Noto Serif) keep layout shift near zero.

## Font hosting (agreed while planning Phase 01)
**Context:** Fontshare's ITF Free Font License v2.0 (17 Aug 2026) allows self-hosting on our own site
but forbids (§02, §05) subsetting, format conversion and distributing the files through a repository
or public server. Our repo is public (AGPL).
**Decision:** Fontshare files are **never committed**. `pnpm fonts:fetch` (`scripts/fonts-fetch.ts`)
downloads the official WOFF2s into `packages/ui/fonts/fontshare/` (gitignored), locally and in CI
(cached). The repository licence does not cover fonts or the EEC logo (README).
**Consequence:** only Fraunces (OFL) is committed. Neither font has U+202F (narrow no-break space, before `; ! ?` in French); the browser draws that blank
from a system font — invisible, and no extra download.

## Colour
Palette approved as proposed in `design-language.md` §2, with changes from the contrast check:
`gold-ink`, `clay-ink`, `line-strong`, a two-ring focus (gold + `focus-outer`), per-season
fill / ink / on-colour tints, and state colours (`success`, `warning`, `danger`, `info`, each with a
`-soft` background). Épiphanie (gold) and Semaine sainte (crimson) were added. 158 pairs checked by
`pnpm contrast`; a unit test fails if any drops below AA.

**Consequences:** tokens are generated from `packages/ui/src/tokens.ts`; changing a colour = edit that
file, run `pnpm --filter @eec/ui tokens`.

## Rules added after approval
- **No one-sided borders.** Quotes use `<Verse>`, dividers use `<Ornament>`; `pnpm lint` fails on any
  `border-t/b/s/e/l/r` or `corner-shape`.
- **`/_brand` is the living brand guidelines and design-system documentation**, kept in production but
  `noindex`, unlinked and out of the sitemap. Being unlisted is not private: access control comes with
  auth in Phase 02. Every component, animation, transition or token is documented there when built.
