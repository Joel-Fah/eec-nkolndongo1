---
name: pexels-curation
description: Find, review and import placeholder photos from the Pexels API (no people, on-theme) into R2 for EEC Nkolndongo 1 until real parish photos arrive. Use when a page needs imagery and no real photo exists.
---

# Pexels curation

Decision 0009. The live site **never** calls Pexels; we curate once and self-host.

## Steps
1. Key in `PEXELS_API_KEY` (env, never committed). Limits: 200 req/h, 20 000/month — cache responses in
   `scripts/.cache/pexels/`.
2. Run `pnpm tsx scripts/pexels/search.ts --theme <theme> --per-page 40 --orientation landscape|portrait`.
   Themes → queries: `light` (church window light, candles), `word` (open bible, hymn book), `nature`
   (green hills, tropical leaves, sunrise), `harvest` (fruits basket, maize, plantain), `space`
   (wooden pews, empty chapel, cross silhouette), `texture` (paper, linen, wood).
3. **Review visually** (Claude reads each thumbnail): reject anything with people/faces/body parts,
   obvious non-Cameroonian cultural markers that feel off, Catholic-specific iconography (statues,
   rosaries), text/watermarks, cold/cheap stock look. Prefer warm light and natural tones.
4. Approved → `scripts/pexels/import.ts` downloads the original, generates AVIF/WebP variants
   (480/960/1600w) + blur placeholder, uploads to R2 under `placeholders/<theme>/<pexels-id>/`.
5. Record in `content/placeholders.json`: id, theme, photographer, photographer URL, Pexels URL, R2 keys,
   `replaceWith: null`.
6. Credits: footer link "Photos : Pexels" + credits page listing photographers.
7. When a real photo arrives, set `replaceWith` and swap; delete the placeholder from R2 when unused.
