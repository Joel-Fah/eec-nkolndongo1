---
name: svg-illustration
description: Draw or edit original SVG illustrations (empty states, banners, loaders, seasonal heroes, 404, story moments) in the EEC Nkolndongo 1 bold flat style. Use whenever an illustration is needed.
---

# SVG illustration

Guide: `docs/design/illustration-guide.md`. References in `assets/images/illustration_references/` are
inspiration only — never trace or reproduce them.

## Workflow
1. Write the **brief**: scenario (e.g. "empty agenda"), one idea, emotion (calm, joy, hope, gentle humour),
   size (banner 16:9 / square / inline 1:1).
2. Compose: one subject, exaggerated scale, generous negative space, a few accent marks.
3. Draw in SVG by hand: simple paths, `viewBox` set, grouped layers with ids (`#subject`, `#hand`, `#marks`, `#shadow`).
4. Colour with CSS variables only: `var(--primary)`, `var(--gold)`, `var(--clay)`, `var(--ink)`,
   `var(--surface)`, `var(--season)`, skin tones `var(--skin-1..4)` — so themes and seasons apply.
5. Line accents on top of fills (round caps, 2–3px at 1×). Small black/ink shadow shapes for depth. No gradients, no filters.
6. Optimise with SVGO (keep ids used by animation); target ≤ 15 KB gzipped.
7. Accessibility: decorative → `aria-hidden="true"`; meaningful → `role="img"` + localised `<title>`.
8. Optional motion: animate groups with GSAP (gentle float, blink, sprinkle marks), respect reduced motion.
9. Save to `packages/ui/illustrations/<name>.svg` and add to the gallery page (admin `/design`).

## Subject library (our world)
Hands holding a Bible / hymn book / drum / offering basket · choir in robes · the hill of Nkolndongo ·
the temple · sheep (404) · dove (Pentecôte) · lamp/star (Avent/Noël) · harvest produce (Moissons) ·
phone with WhatsApp bubble · child asleep on a pew (empty state).

## Never
Depict the face of God/Christ · caricature · single skin tone for everyone · copy reference compositions.
