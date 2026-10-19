# Design language

Mood: **modern, gentle, subtle, sleek, welcoming, charming, elegant — with a smirk.**
Reference for *feel only* (do not replicate): maree-lndev.vercel.app.
Palette, logo and fonts approved on the brand board (decision 0015); other values are still provisional.

## 1. Brand mark
- Source: `assets/images/eec-logo-tr.png` (EEC universal logo). To be redrawn as clean SVG
  (`packages/ui/brand/`), plus a variant **without the embedded "Eglise Evangélique du Cameroun" text**.
- Lockups (horizontal):
  - **Short**: mark + `EEC NKOLNDONGO 1`
  - **Long**: mark + `Église Évangélique du Cameroun` / `Paroisse de Nkolndongo 1` (two lines)
- Each in light-bg, dark-bg and monochrome versions. Clear space = height of the "E".
- The official mark's shapes and proportions are never altered; colours may be tuned only in the
  monochrome versions.

## 2. Colour (tokens)
Derived from the logo (green, yellow, black, white), refined.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FBF8F1` warm cream | `#0E1612` deep green-black | Page background |
| `--surface` | `#FFFFFF` | `#16211B` | Cards, sheets |
| `--surface-2` | `#F4EFE4` | `#1D2A23` | Subtle fills, inputs |
| `--ink` | `#16201A` | `#F3EFE6` | Text |
| `--ink-muted` | `#5E6B62` | `#A9B5AC` | Secondary text |
| `--line` | `#E7E1D4` | `#2A3830` | Borders, dividers |
| `--primary` | `#1F5C3A` forest | `#6CC48A` | Actions, links |
| `--gold` | `#E8B931` sun-gold | `#F0C64B` | Highlights, accents, focus ring |
| `--clay` | `#D9643A` | `#E98360` | Illustrations, rare emphasis |

**Season accents** (`--season`): Avent `#6B4FA0` · Noël/Pâques `#E8B931` · Carême `#5B3F7A` ·
Pentecôte `#C2412D` · Temps ordinaire `#1F5C3A` · Moissons `#C98A2B`.
All text/background pairs must pass WCAG AA in both themes (checked by script).

## 3. Shape — rounded, Apple-like (no pills, no squircles)
Generous but not pill-shaped radii, standard `border-radius` (no `corner-shape: squircle`).

| Token | Value | Used for |
|---|---|---|
| `--radius-xs` | 6px | Tags, small badges, checkbox |
| `--radius-sm` | 10px | Chips, menu items, tooltips |
| `--radius-md` | 14px | Buttons, inputs, selects |
| `--radius-lg` | 20px | Cards, dropdown panels, popovers |
| `--radius-xl` | 28px | Sheets, dialogs, hero media |

- **Concentric rule:** inner radius = outer radius − padding (never inner > outer).
- **No one-sided borders, ever** (no side rule on quotes, no `border-bottom` dividers). Frames are
  complete or absent; separate with space, a tint, shadow or the hand-drawn `<Ornament>`. Quotations use
  `<Verse>` (soft gold panel + oversized mark). Checked by `scripts/check-design-rules.ts`.
- **Floating navigation:** headers, sidebars and sheets are lifted off the viewport edges, rounded on every
  corner, blurred. On mobile they open full screen and lock the page scroll.
- **Scrollbars** are always rounded; inside panels they float inside and only show on hover.
- Buttons are *not* fully rounded; only avatars and the theme toggle knob are circles.

## 4. Elevation
Soft, warm, layered shadows (low opacity, large blur, slight y-offset), tinted with `--ink`, never grey
black. 3 levels: `--shadow-1` (cards), `--shadow-2` (dropdowns/popovers), `--shadow-3` (dialogs).
In dark mode, elevation = lighter surface + faint top highlight border rather than shadow.

## 5. Typography
- **Headings: Erode** (Fontshare, ITF FFL, variable 300–700 — decision 0023, replaces Fraunces). **Text & UI: Switzer** (Fontshare, free commercial licence) — self-hosted, subset Latin + French.
  No Inter, no Geist.
- **Display:** **Erode** for headings — chosen by Joël (decision 0023), replacing Fraunces.
- Fluid type scale (clamp), ratio ~1.25 mobile / 1.333 desktop. Body 17–18px, line-height 1.6.
- French typography: non-breaking space before `: ; ! ?` and inside « guillemets » (handled by an i18n
  helper), proper apostrophe `’`.

## 6. Icons
Hugeicons **stroke-rounded** only, 1.5px stroke, sizes 16/20/24. Colour = `currentColor`.

## 7. Motion
- Easing: `--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-in-out: cubic-bezier(.65,0,.35,1)`.
- Durations: micro 120–180 ms · UI 220–320 ms · narrative 600–1200 ms (scroll-driven).
- Enter = fade + 8–16px rise; exit faster than enter. No bounce on UI; a touch of overshoot allowed on
  illustrations only.
- `prefers-reduced-motion`: remove scroll-scrubbing and parallax, keep opacity fades ≤ 150 ms.
- Details in `.claude/skills/gsap-motion`.

## 8. Components (all on-brand)
Button (primary / secondary / ghost / link) · Input · Textarea · Select · Combobox · Dropdown menu ·
Checkbox · Radio · Switch · Tabs · Accordion · Dialog · Sheet · Popover · Tooltip · Toast · Card ·
Badge · Avatar · Skeleton · Empty state · Date picker · Data table (admin) · Command palette (admin).
Public site: native platform elements (`<dialog>`, `popover`, `<details>`); admin: Base UI — one shared
stylesheet, tokens only (decision 0016). Documented live in `/fr/_brand`.

## 9. Imagery
Real parish photos (when available) > curated Pexels (no people) > illustrations. Warm grade, slight
grain allowed. Always responsive AVIF/WebP with blur-up placeholder.
