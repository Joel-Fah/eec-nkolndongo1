import { describe, expect, it } from 'vitest'
import { bandCounts, csvCell, visiblePhone } from './group-space.ts'

describe('Mon groupe rules', () => {
  it('shows age bands only from 5 people with a known band', () => {
    expect(bandCounts(['18-25', '18-25', '26-35', null, null])).toBeNull()
    expect(bandCounts(['18-25', '18-25', '26-35', '26-35', 'over65'])).toEqual({
      '18-25': 2,
      '26-35': 2,
      over65: 1,
    })
  })
  it('shows a phone number only when shared and given', () => {
    expect(visiblePhone(true, '690000000')).toBe('690000000')
    expect(visiblePhone(false, '690000000')).toBeNull()
    expect(visiblePhone(true, null)).toBeNull()
  })
  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=1+1')).toBe(`"'=1+1"`)
    expect(csvCell('Ana "B"')).toBe('"Ana ""B"""')
  })
})
