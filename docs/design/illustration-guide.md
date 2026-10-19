# Illustration guide

Decision 0024: we use **Storyset illustrations in the "Cuate" style** (storyset.com), recoloured into our
palette. We no longer draw our own scenes. References in `assets/images/illustration_references/` stay local.

## Choosing one
- One idea per illustration; people doing something real (welcoming, reading, gathering, celebrating).
- Avoid illustrations with **baked-in text** (e.g. "WELCOME!"): it can't be translated.
- Avoid anything that misrepresents the parish or depicts God or Christ's face; prefer diverse ages and genders.
- Check the dark-theme version too (`/fr/_brand` → Icônes et illustrations).

## Adding one
1. Find it on storyset.com (Cuate). Its page is `/illustration/<slug>/cuate`.
2. Add `{ name, url, background, use }` to `packages/ui/illustrations/storyset.json` (the SVG URL from the
   page). `background: false` drops Storyset's background layer for small uses.
3. `pnpm illos:fetch` (add `--force` to redo). The script prints any colour it could not map.
4. Use it: `<Illustration name="…" />` (Astro) or `<Illustration name="…" />` (admin). Decorative unless
   you pass `title` (then a localised one).

## Rules
- Never commit the SVG files (licence): they live in gitignored `public/illustrations/`.
- Credit stays in the footer (« Illustrations : Storyset ») and on the legal page.
- Colours come from `storysetPalette` + `skin` in `packages/ui/src/tokens.ts`. Skin tones always become ours.
- Never inline them in the shell (13–30 KB each); they load lazily as images.
- No looping or idle animation. A gentle lift/scale of the container on hover is enough.
