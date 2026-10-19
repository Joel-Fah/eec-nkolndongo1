import { colors, contrastPairs, focusPairs, type Season, seasons } from './tokens.ts'

export type Theme = 'light' | 'dark'

function channel(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

/** WCAG 2.x contrast ratio. */
export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export type ContrastRow = {
  theme: Theme
  fg: string
  bg: string
  fgHex: string
  bgHex: string
  ratio: number
  min: number
  pass: boolean
}

const color = (name: string, theme: Theme): string => {
  const token = colors[name as keyof typeof colors]
  if (!token) throw new Error(`Unknown colour token: ${name}`)
  return token[theme]
}

function row(theme: Theme, fg: string, bg: string, fgHex: string, bgHex: string, min: number) {
  const r = ratio(fgHex, bgHex)
  return { theme, fg, bg, fgHex, bgHex, ratio: Math.round(r * 100) / 100, min, pass: r >= min }
}

/** Every checked pair, both themes: base colours, focus ring, season accents. */
export function contrastReport(): ContrastRow[] {
  const rows: ContrastRow[] = []
  for (const theme of ['light', 'dark'] as const) {
    for (const [fg, bg, min] of contrastPairs) {
      rows.push(row(theme, fg, bg, color(fg, theme), color(bg, theme), min))
    }
    for (const bg of focusPairs) {
      const gold = row(theme, 'gold', bg, color('gold', theme), color(bg, theme), 3)
      const outer = row(theme, 'focus-outer', bg, color('focus-outer', theme), color(bg, theme), 3)
      rows.push(
        gold.ratio >= outer.ratio
          ? { ...gold, fg: 'focus (gold)' }
          : { ...outer, fg: 'focus (outer)' },
      )
    }
    for (const [name, values] of Object.entries(seasons) as [Season, (typeof seasons)[Season]][]) {
      const s = values[theme]
      for (const bg of ['bg', 'surface'] as const) {
        rows.push(row(theme, `season-ink:${name}`, bg, s.ink, color(bg, theme), 4.5))
      }
      rows.push(row(theme, `on-season:${name}`, `season:${name}`, s.on, s.fill, 4.5))
    }
  }
  return rows
}
