import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastReport, ratio } from './contrast.ts'
import { fluid, renderTokensCss } from './tokens-css.ts'

describe('tokens', () => {
  it('tokens.css is generated from tokens.ts (run `pnpm --filter @eec/ui tokens`)', () => {
    const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')
    expect(css).toBe(renderTokensCss())
  })

  it('every text/background pair passes WCAG AA in both themes', () => {
    const failing = contrastReport().filter((row) => !row.pass)
    expect(failing).toEqual([])
  })

  it('computes WCAG ratios and fluid sizes', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(fluid(17, 18)).toBe('clamp(1.0625rem, 1.038rem + 0.1087vw, 1.125rem)')
    expect(fluid(13, 13)).toBe('0.8125rem')
  })
})
