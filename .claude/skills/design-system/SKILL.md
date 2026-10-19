---
name: design-system
description: Build or modify any UI (components, layouts, pages) for the EEC Nkolndongo 1 public site or admin so it matches the design language - tokens, rounded Apple-like shapes, themes, typography, icons, accessibility. Use for any visual/UI work.
---

# Design system

Source of truth: `docs/design/design-language.md`. Tokens live in `packages/ui/tokens.css`.

## Rules
- **Tokens only.** Colours, radii, shadows, spacing, durations come from CSS variables. No raw hex/px in components.
- **Both themes** (`[data-theme="light"|"dark"]` + `prefers-color-scheme`) and **both locales** checked for every component. French strings run ~20% longer — design for it.
- **Shape:** rounded, Apple-like. `--radius-md` (14px) buttons/inputs, `--radius-lg` (20px) cards/dropdowns, `--radius-xl` (28px) dialogs/sheets. **No pills, no squircles.** Concentric rule: inner = outer − padding.
- **No one-sided borders** (never `border-t/b/s/e/l/r`, no side rule on quotes) — `<Verse>` for quotes, `<Ornament>` for dividers.
- **Floating navigation** (lifted off the edges, rounded all around); scrollbars rounded, auto-hidden inside panels; every nav entry has an icon.
- **Document it:** add the component/animation/token to the living guide (`/fr/_brand`) in the same change.
- **Icons:** Hugeicons stroke-rounded via the `<Icon>` wrapper in `packages/ui`; `currentColor`; 16/20/24.
- **Type:** Switzer for text/UI, Fraunces for headings only. French spacing helper for `: ; ! ?` and « ».
- **Primitives:** Radix/Base UI underneath for a11y (focus trap, roving focus, ARIA). Every dropdown, select, combobox, popover, dialog must look on-brand — never browser-default or library-default styling.
- **States:** default, hover, active, focus-visible (gold ring, 2px offset), disabled, loading, error, empty.
- **Touch targets** ≥ 44×44 px. Contrast AA in both themes.
- **Elevation:** shadow levels in light; lighter surface + top highlight in dark.

## Checklist before done
- [ ] Light & dark screenshots look intentional
- [ ] FR & EN fit without overflow at 320px width
- [ ] Keyboard only: reachable, operable, visible focus, Esc closes overlays
- [ ] Reduced motion respected
- [ ] No new dependency unless justified in a decision record
