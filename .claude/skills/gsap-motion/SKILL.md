---
name: gsap-motion
description: Add or review animations, scroll storytelling, text reveals, page transitions or illustration animation with GSAP (ScrollTrigger, SplitText, MorphSVG) on the EEC Nkolndongo 1 site. Use for any motion or interaction work.
---

# GSAP motion

Motion serves the story; it never blocks content. Spec: `docs/design/design-language.md` §7 and page
signatures in `docs/product/pages.md`.

## Loading
- Import GSAP **only in the island/script of pages that need it** (dynamic `import('gsap')`), never globally.
- Register plugins explicitly: `gsap.registerPlugin(ScrollTrigger, SplitText)`.
- Simple hovers/fades → CSS, not GSAP. Page changes → Astro View Transitions.

## Conventions
- Shared presets in `packages/ui/motion.ts`: `ease.out = 'expo.out'`-like curve matching
  `cubic-bezier(.22,1,.36,1)`, durations `micro .15`, `ui .28`, `story .9`.
- Wrap each page's motion in `gsap.context()` / `gsap.matchMedia()` and **revert on cleanup**
  (`astro:before-swap`) to avoid leaks with View Transitions.
- Reduced motion:
  ```ts
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => { /* full story */ });
  mm.add('(prefers-reduced-motion: reduce)', () => { /* opacity only, ≤150ms */ });
  ```
- Also downgrade on `navigator.connection?.saveData`.
- Animate `transform` and `opacity` only (no layout properties). Use `will-change` sparingly.
- ScrollTrigger: `scrub: 0.6–1` for narrative, `once: true` for reveals; `pin` only on desktop
  (≥ 1024px) unless tested on low-end Android; always `invalidateOnRefresh: true`.
- SplitText: split into lines/words, not chars, for body copy; `aria` preserved (`SplitText` `aria: 'auto'`).
- Content must be fully readable **before** JS runs (no `opacity:0` in CSS without a `.js` class guard).

## Review checklist
- [ ] 60 fps on a throttled mid-range profile (CPU 4×)
- [ ] Works with reduced motion and Save-Data
- [ ] No CLS caused by animation
- [ ] Cleanup on navigation verified
