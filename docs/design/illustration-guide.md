# Illustration guide

References in `assets/images/illustration_references/` are **for inspiration only — never traced,
copied or shipped.** We draw our own SVGs.

## What we take from the references
- Flat, bold shapes; exaggerated scale (oversized hands, objects close to camera).
- Expressive line accents drawn *on top* of fills (folds, knuckles, motion marks).
- Small, sharp black "shadow" shapes for depth instead of gradients.
- Playful confetti/sprinkle marks around the subject.
- Lots of negative space; one subject, one idea.

## What we change
- **Our palette** (forest green, sun-gold, clay, cream, ink + the season accent) instead of
  purple/blue/coral.
- **Real Cameroonian skin tones** — a range of warm browns (define 4 tones in tokens), not a single
  orange tone.
- **Our world**: Bible, hymn book, drums (tam-tam), offering basket, harvest produce, choir robes,
  the hill of Nkolndongo, the temple, sheep, doves, lamps, phones/WhatsApp.
- Respectful: no depiction of God or Christ's face; no caricature; diverse ages and genders.

## Where illustrations are used (and only there)
Empty states · loaders · promo/info banners · seasonal heroes · 404/errors · onboarding (Mon espace) ·
key story moments (Notre histoire, Moissons basket). Everywhere else: icons.

## Technical rules
- Hand-authored or optimised SVG (SVGO), `viewBox` set, no embedded raster, ≤ 15 KB gzipped each.
- Colours via `currentColor` / CSS variables so they adapt to theme and season.
- Group layers by meaning (`#hand`, `#basket`, `#marks`) so GSAP can animate parts.
- `role="img"` + localised `<title>` when meaningful, `aria-hidden="true"` when decorative.
- Workflow and checklist: `.claude/skills/svg-illustration`.
