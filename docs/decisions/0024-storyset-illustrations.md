# 0024 — Storyset (Cuate) illustrations instead of drawing our own
**Status:** Accepted · 2026-10-19 · supersedes the "we draw our own SVGs" part of the illustration guide
**Context:** Hand-drawn scenes with people did not reach the natural look Joël wants (Storyset "Cuate").
Storyset's licence allows use on a website and changing colours, with credit, but forbids distributing the
files — and this repository is public. Storyset has no API.
**Decision:** We use Storyset Cuate illustrations. Only their URLs are committed
(`packages/ui/illustrations/storyset.json`). `pnpm illos:fetch` (also run by `@eec/ui`'s build, like the
fonts) downloads each one, recolours it into our palette (`storysetPalette` + `skin` in `tokens.ts`:
accent → gold, slate and greys per theme, skin tones → ours), optimises it with SVGO, and writes a light and
a dark file into the gitignored `public/illustrations/` of the site and the admin. `<Illustration>` shows
the file for the current theme as a lazy `<img>`: nothing is downloaded until it is displayed. Credit
« Illustrations : Storyset » in the footer and on the legal page. No looping animation.
**Consequences:** Each illustration is 13–30 KB compressed, so they never sit inline in the shell; the
mega-menu art loads only when a menu opens. Our earlier hand-drawn SVGs are removed. The accent is gold
(not the season colour): one file per theme, not per season. CI needs network access to Storyset at build
time (cached like the fonts).
