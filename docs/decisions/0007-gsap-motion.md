# 0007 — GSAP for motion
**Status:** Accepted · 2026-10-19
**Context:** Scroll storytelling, text reveals and SVG illustration animation are core to the experience.
GSAP and all its plugins are free since 2025.
**Decision:** GSAP (core + ScrollTrigger, SplitText, MorphSVG as needed) loaded per page; CSS for simple
transitions; Astro View Transitions for page changes. No second animation library.
**Consequences:** ~35–40 KB gz on story pages only. Conventions in the `gsap-motion` skill.
