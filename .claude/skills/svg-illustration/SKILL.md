---
name: svg-illustration
description: Add, choose or theme an illustration (empty states, banners, menus, 404, story moments) for EEC Nkolndongo 1. Illustrations are Storyset "Cuate" SVGs recoloured into our palette (decision 0024). Use whenever an illustration is needed.
---

# Illustrations (Storyset Cuate)

Guide: `docs/design/illustration-guide.md`. Decision 0024. We do **not** draw our own scenes any more.

## Workflow
1. Brief: scenario (e.g. "empty agenda"), one idea, emotion (calm, joy, welcome).
2. Find a Cuate illustration on storyset.com: page `https://storyset.com/illustration/<slug>/cuate`.
   No baked-in text, nothing that misrepresents the parish, no depiction of God or Christ's face.
3. Take the main SVG URL (first `contentUrl` in the page's ld+json) and add
   `{ name, url, background, use }` to `packages/ui/illustrations/storyset.json`.
4. `pnpm illos:fetch` (`--force` to redo). Read the "kept as is" colours it prints; extend the mapping in
   `scripts/illos-fetch.ts` if a colour should follow the theme.
5. Check light **and** dark on `/fr/_brand` → Icônes et illustrations.
6. Use `<Illustration name="…" />` (Astro, `@eec/ui/astro/Illustration.astro`; pass `eager` above the fold,
   `title` when meaningful) or the admin's `<Illustration name="…" />`.

## Never
Commit the SVG files (licence) · inline them in the shell (13–30 KB each) · loop-animate them ·
remove the « Illustrations : Storyset » credit.
