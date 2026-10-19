/**
 * Design tokens — the single source of truth (docs/design/design-language.md).
 * `pnpm --filter @eec/ui tokens` writes ../tokens.css from this file; a test keeps them in sync.
 * Contrast of every text/background pair is checked by `pnpm contrast` (scripts/contrast-check.ts).
 *
 * Status: provisional — values changed by the contrast check are marked ⚑ (see the brand board).
 */

export type Themed = { light: string; dark: string }

/** Colours that change with the theme. */
export const colors = {
  bg: { light: '#FBF8F1', dark: '#0E1612' },
  surface: { light: '#FFFFFF', dark: '#16211B' },
  'surface-2': { light: '#F4EFE4', dark: '#1D2A23' },
  /** Popovers, menus, dialogs: in dark, elevation = a lighter surface. */
  'surface-raised': { light: '#FFFFFF', dark: '#22302A' },
  ink: { light: '#16201A', dark: '#F3EFE6' },
  'ink-muted': { light: '#5E6B62', dark: '#A9B5AC' },
  line: { light: '#E7E1D4', dark: '#2A3830' },
  /** ⚑ Borders that identify a control (inputs, checkboxes) need 3:1 (WCAG 1.4.11). */
  'line-strong': { light: '#8E8672', dark: '#5D7567' },
  primary: { light: '#1F5C3A', dark: '#6CC48A' },
  'on-primary': { light: '#FFFFFF', dark: '#0E1612' },
  'primary-soft': { light: '#E4EEE6', dark: '#1C3427' },
  gold: { light: '#E8B931', dark: '#F0C64B' },
  /** ⚑ Gold is 1.7:1 on cream — never text in light. Use gold-ink for gold-coloured text/icons. */
  'gold-ink': { light: '#806210', dark: '#F0C64B' },
  'gold-soft': { light: '#FBF1D2', dark: '#3A3218' },
  /** Text on a gold fill (badges, highlights). */
  'on-gold': { light: '#16201A', dark: '#0E1612' },
  clay: { light: '#D9643A', dark: '#E98360' },
  /** ⚑ Clay is 3.4:1 on cream — large text only. clay-ink for small text. */
  'clay-ink': { light: '#B0461F', dark: '#E98360' },
  /** States — text/icons (4.5:1 on every surface) and their soft backgrounds (alerts, toasts, badges). */
  success: { light: '#1B6E3F', dark: '#5FD08A' },
  'success-soft': { light: '#E1F1E6', dark: '#14301F' },
  warning: { light: '#8A5200', dark: '#F2B24A' },
  'warning-soft': { light: '#FCEBCB', dark: '#3A2A0E' },
  danger: { light: '#B3261E', dark: '#F2867B' },
  'danger-soft': { light: '#FBE9E6', dark: '#3B1D1A' },
  info: { light: '#1F5FA8', dark: '#7DB2EA' },
  'info-soft': { light: '#E1ECF8', dark: '#12283F' },
  /** Illustrations: paper stays light, shadows stay dark, whatever the theme. */
  'illo-paper': { light: '#FFFDF8', dark: '#EAE3D3' },
  'illo-shadow': { light: '#16201A', dark: '#050906' },
  'illo-line': { light: '#B0461F', dark: '#C8603A' },
  /** ⚑ Focus: gold ring + an outer ring that guarantees 3:1 (gold alone fails on cream). */
  'focus-outer': { light: '#1F5C3A', dark: '#0E1612' },
} as const satisfies Record<string, Themed>

/** Liturgical season accents. `fill` is decorative; `ink` is text-safe (4.5:1); `on` sits on fill. */
export type SeasonTokens = { fill: string; ink: string; on: string }
export const seasons = {
  avent: {
    light: { fill: '#6B4FA0', ink: '#6B4FA0', on: '#FFFFFF' },
    dark: { fill: '#8B72C2', ink: '#A28DCC', on: '#0E1612' },
  },
  noel: {
    light: { fill: '#E8B931', ink: '#806210', on: '#16201A' },
    dark: { fill: '#F0C64B', ink: '#F0C64B', on: '#0E1612' },
  },
  /** ⚑ Not in design-language — proposed: the gold of Noël (to confirm). */
  epiphanie: {
    light: { fill: '#E8B931', ink: '#806210', on: '#16201A' },
    dark: { fill: '#F0C64B', ink: '#F0C64B', on: '#0E1612' },
  },
  careme: {
    light: { fill: '#5B3F7A', ink: '#5B3F7A', on: '#FFFFFF' },
    dark: { fill: '#9474BA', ink: '#A88CC6', on: '#0E1612' },
  },
  /** ⚑ Not in design-language — proposed: a deep crimson (to confirm). */
  'semaine-sainte': {
    light: { fill: '#8E2A3A', ink: '#8E2A3A', on: '#FFFFFF' },
    dark: { fill: '#D0606F', ink: '#DE8190', on: '#0E1612' },
  },
  paques: {
    light: { fill: '#E8B931', ink: '#806210', on: '#16201A' },
    dark: { fill: '#F0C64B', ink: '#F0C64B', on: '#0E1612' },
  },
  pentecote: {
    light: { fill: '#C2412D', ink: '#B23A27', on: '#FFFFFF' },
    dark: { fill: '#E0604A', ink: '#E8806F', on: '#0E1612' },
  },
  ordinaire: {
    light: { fill: '#1F5C3A', ink: '#1F5C3A', on: '#FFFFFF' },
    dark: { fill: '#3E9A66', ink: '#6CC48A', on: '#0E1612' },
  },
  moissons: {
    light: { fill: '#C98A2B', ink: '#8A5F1D', on: '#16201A' },
    dark: { fill: '#D99A3A', ink: '#E2A951', on: '#0E1612' },
  },
} as const satisfies Record<string, { light: SeasonTokens; dark: SeasonTokens }>

export type Season = keyof typeof seasons
export const seasonNames = Object.keys(seasons) as Season[]

/** Illustration skin tones — warm browns, same in both themes. */
export const skin = ['#C68B5E', '#9C6440', '#6E4129', '#4A2A1A'] as const

/** Soft, warm, layered shadows tinted with ink; in dark: deeper shadow + a faint top highlight. */
export const elevation = {
  1: {
    light: '0 1px 2px rgb(22 32 26 / 0.05), 0 4px 14px -2px rgb(22 32 26 / 0.07)',
    dark: 'inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.3)',
  },
  2: {
    light: '0 2px 4px rgb(22 32 26 / 0.05), 0 14px 32px -6px rgb(22 32 26 / 0.13)',
    dark: 'inset 0 1px 0 rgb(255 255 255 / 0.06), 0 12px 28px -6px rgb(0 0 0 / 0.5)',
  },
  3: {
    light: '0 4px 8px rgb(22 32 26 / 0.06), 0 28px 60px -12px rgb(22 32 26 / 0.22)',
    dark: 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 28px 60px -12px rgb(0 0 0 / 0.65)',
  },
} as const satisfies Record<number, Themed>

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 } as const

export const fonts = {
  sans: '"Switzer", "Switzer Fallback", "Switzer Fallback Android", ui-sans-serif, system-ui, sans-serif',
  /** Headings, lockups, big numbers. Fraunces (SIL OFL, soft + wonk) — chosen by Joël on the brand board. */
  display: '"Fraunces", "Fraunces Fallback", "Fraunces Fallback Android", ui-serif, Georgia, serif',
} as const

export const motion = {
  ease: { out: 'cubic-bezier(0.22, 1, 0.36, 1)', 'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)' },
  /** ms — reduced motion: UI ≤ 120, narrative becomes a 150 ms fade. */
  duration: {
    micro: { normal: 150, reduced: 100 },
    ui: { normal: 260, reduced: 120 },
    story: { normal: 900, reduced: 150 },
  },
  /** Enter = fade + rise; no rise when motion is reduced. */
  rise: { normal: 12, reduced: 0 },
} as const

/** Fluid type scale (px at 360 → 1280 px viewport); body 17 → 18 px, ratio ~1.25 → 1.333. */
export const type = {
  xs: [13, 13, 1.45],
  sm: [14.5, 15, 1.5],
  base: [17, 18, 1.6],
  lg: [19.5, 22, 1.5],
  xl: [23, 28, 1.3],
  '2xl': [28, 37, 1.2],
  '3xl': [33, 50, 1.12],
  '4xl': [40, 67, 1.05],
} as const satisfies Record<string, readonly [number, number, number]>

/** Text/background pairs that must pass WCAG AA in both themes. [fg, bg, min ratio] */
export const contrastPairs: readonly [string, string, number][] = [
  ...(['bg', 'surface', 'surface-2', 'surface-raised'] as const).flatMap((bg) =>
    (
      [
        'ink',
        'ink-muted',
        'primary',
        'gold-ink',
        'clay-ink',
        'success',
        'warning',
        'danger',
        'info',
      ] as const
    ).map((fg) => [fg, bg, 4.5] as [string, string, number]),
  ),
  ['on-primary', 'primary', 4.5],
  ['ink', 'primary-soft', 4.5],
  ['primary', 'primary-soft', 4.5],
  ['ink', 'gold-soft', 4.5],
  ['on-gold', 'gold', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['info', 'info-soft', 4.5],
  ['line-strong', 'bg', 3],
  ['line-strong', 'surface', 3],
  ['gold', 'bg', 1], // decorative only — listed so the board shows why gold is never text
]

/** Focus ring (non-text, 3:1): passes when the gold ring or its outer ring stands out. */
export const focusPairs = ['bg', 'surface', 'surface-2', 'surface-raised'] as const
