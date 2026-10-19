import {
  colors,
  elevation,
  fonts,
  motion,
  radius,
  type Season,
  seasons,
  skin,
  type,
} from './tokens.ts'

type Theme = 'light' | 'dark'

const VIEWPORT_MIN = 360
const VIEWPORT_MAX = 1280
const rem = (px: number) => `${+(px / 16).toFixed(4)}rem`

/** clamp() growing linearly from `min` px at 360 px viewport to `max` px at 1280 px. */
export function fluid(min: number, max: number): string {
  if (min === max) return rem(min)
  const slope = (max - min) / (VIEWPORT_MAX - VIEWPORT_MIN)
  const intercept = min - slope * VIEWPORT_MIN
  return `clamp(${rem(min)}, ${rem(intercept)} + ${+(slope * 100).toFixed(4)}vw, ${rem(max)})`
}

const block = (selector: string, lines: string[], indent = '') =>
  `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join('\n')}\n${indent}}`

function themeLines(theme: Theme): string[] {
  const s = seasons.ordinaire[theme]
  return [
    `color-scheme: ${theme};`,
    ...Object.entries(colors).map(([name, value]) => `--${name}: ${value[theme]};`),
    ...Object.entries(elevation).map(([level, value]) => `--elevation-${level}: ${value[theme]};`),
    `--season: ${s.fill};`,
    `--season-ink: ${s.ink};`,
    `--on-season: ${s.on};`,
  ]
}

function seasonLines(name: Season, theme: Theme): string[] {
  const s = seasons[name][theme]
  return [`--season: ${s.fill};`, `--season-ink: ${s.ink};`, `--on-season: ${s.on};`]
}

export function renderTokensCss(): string {
  const out: string[] = [
    '/* GENERATED from packages/ui/src/tokens.ts — do not edit by hand.',
    ' * Regenerate: pnpm --filter @eec/ui tokens. Requires Tailwind v4 (@theme). */',
    '',
    // Tailwind theme: only our tokens exist (defaults reset), theme-independent values.
    block('@theme', [
      '--color-*: initial;',
      '--radius-*: initial;',
      '--shadow-*: initial;',
      '--font-*: initial;',
      '--ease-*: initial;',
      '--text-*: initial;',
      ...Object.entries(radius).map(([k, v]) => `--radius-${k}: ${v}px;`),
      ...Object.entries(fonts).map(([k, v]) => `--font-${k}: ${v};`),
      ...Object.entries(motion.ease).map(([k, v]) => `--ease-${k}: ${v};`),
      ...Object.entries(type).flatMap(([k, [min, max, lh]]) => [
        `--text-${k}: ${fluid(min, max)};`,
        `--text-${k}--line-height: ${lh};`,
      ]),
      '--default-transition-duration: var(--duration-ui);',
      '--default-transition-timing-function: var(--ease-out);',
    ]),
    '',
    // Themed values are referenced, so utilities follow [data-theme] and [data-season].
    block('@theme inline', [
      ...Object.keys(colors).map((name) => `--color-${name}: var(--${name});`),
      '--color-season: var(--season);',
      '--color-season-ink: var(--season-ink);',
      '--color-on-season: var(--on-season);',
      ...skin.map((_, i) => `--color-skin-${i + 1}: var(--skin-${i + 1});`),
      ...Object.keys(elevation).map((level) => `--shadow-${level}: var(--elevation-${level});`),
    ]),
    '',
    block(':root', [
      ...skin.map((value, i) => `--skin-${i + 1}: ${value};`),
      ...Object.entries(motion.duration).map(([k, v]) => `--duration-${k}: ${v.normal}ms;`),
      `--rise: ${motion.rise.normal}px;`,
    ]),
    '',
    '@media (prefers-reduced-motion: reduce) {',
    block(
      ':root',
      [
        ...Object.entries(motion.duration).map(([k, v]) => `--duration-${k}: ${v.reduced}ms;`),
        `--rise: ${motion.rise.reduced}px;`,
      ],
      '  ',
    ),
    '}',
    '',
    block(':root,\n[data-theme="light"]', themeLines('light')),
    '',
    block('[data-theme="dark"]', themeLines('dark')),
    '',
    '@media (prefers-color-scheme: dark) {',
    block(':root:not([data-theme])', themeLines('dark'), '  '),
    '}',
    '',
    '/* Liturgical seasons — data-season on <html> (or a themed panel). */',
  ]
  const names = Object.keys(seasons) as Season[]
  for (const name of names) {
    const s = `[data-season="${name}"]`
    out.push(block(s, seasonLines(name, 'light')))
    out.push(block(`[data-theme="dark"]${s},\n[data-theme="dark"] ${s}`, seasonLines(name, 'dark')))
    out.push(
      `@media (prefers-color-scheme: dark) {\n${block(
        `:root:not([data-theme])${s},\n  :root:not([data-theme]) ${s}`,
        seasonLines(name, 'dark'),
        '  ',
      )}\n}`,
    )
  }
  out.push('', '/* A panel that sets its own theme and season wins over its ancestors. */')
  for (const name of names) {
    for (const theme of ['light', 'dark'] as const) {
      out.push(block(`[data-theme="${theme}"][data-season="${name}"]`, seasonLines(name, theme)))
    }
  }
  return `${out.join('\n')}\n`
}
