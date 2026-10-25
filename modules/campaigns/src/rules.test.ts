import { describe, expect, it } from 'vitest'
import {
  amountOk,
  daysLeft,
  daysUntil,
  fillOf,
  inSeason,
  mayValidate,
  percentOf,
  phaseOf,
  shareCardSvg,
  xaf,
} from './rules.ts'

describe('a campaign season', () => {
  it('knows before, during and after', () => {
    expect(phaseOf('2026-11-01', '2026-11-08', '2026-10-31')).toBe('before')
    expect(phaseOf('2026-11-01', '2026-11-08', '2026-11-01')).toBe('during')
    expect(phaseOf('2026-11-01', '2026-11-08', '2026-11-08')).toBe('during')
    expect(phaseOf('2026-11-01', '2026-11-08', '2026-11-09')).toBe('after')
  })
  it('counts days', () => {
    expect(daysLeft('2026-11-08', '2026-11-08')).toBe(1)
    expect(daysLeft('2026-11-08', '2026-11-01')).toBe(8)
    expect(daysLeft('2026-11-08', '2026-11-20')).toBe(0)
    expect(daysUntil('2026-11-01', '2026-10-25')).toBe(7)
    expect(daysUntil('2026-11-01', '2026-11-05')).toBe(0)
  })
  it('computes percent and the fill, which stops at the brim', () => {
    expect(percentOf(250_000, 1_000_000)).toBe(25)
    expect(percentOf(1_200_000, 1_000_000)).toBe(120)
    expect(fillOf(1_200_000, 1_000_000)).toBe(100)
    expect(percentOf(5, 0)).toBe(0)
  })
})
describe('money and who may validate', () => {
  it('writes francs the local way', () => {
    expect(xaf(5000)).toBe('5 000 FCFA')
    expect(xaf(1234567)).toBe('1 234 567 FCFA')
    expect(xaf(0)).toBe('0 FCFA')
  })
  it('accepts whole positive amounts only', () => {
    for (const bad of [0, -5, 1.5, '100', null, 600_000_000]) expect(amountOk(bad)).toBe(false)
    expect(amountOk(1)).toBe(true)
  })
  it('does not let anyone validate what they entered, except the super admin', () => {
    expect(mayValidate('a', 'a', false)).toBe(false)
    expect(mayValidate('a', 'b', false)).toBe(true)
    expect(mayValidate('a', 'a', true)).toBe(true)
    expect(mayValidate('a', null, false)).toBe(true)
  })
  it('draws a share card that cannot inject markup', () => {
    const svg = shareCardSvg({
      title: '<script>"x"',
      raised: 500,
      goal: 1000,
      percent: 50,
      line: 'l',
      church: 'c',
    })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('50 %')
  })
})

describe('the season of the page', () => {
  it('starts two weeks before and ends a week after', () => {
    expect(inSeason('2026-11-01', '2026-11-08', '2026-10-17')).toBe(false)
    expect(inSeason('2026-11-01', '2026-11-08', '2026-10-18')).toBe(true)
    expect(inSeason('2026-11-01', '2026-11-08', '2026-11-15')).toBe(true)
    expect(inSeason('2026-11-01', '2026-11-08', '2026-11-16')).toBe(false)
  })
})
