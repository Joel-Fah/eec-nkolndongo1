import { describe, expect, it } from 'vitest'
import { csvCell } from './csv.ts'

describe('csvCell', () => {
  it('quotes and escapes', () => {
    expect(csvCell('Marie "Mimi" Ngono')).toBe('"Marie ""Mimi"" Ngono"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(new Date('2026-10-20T10:00:00Z'))).toBe('"2026-10-20"')
  })
  it('defuses spreadsheet formulas', () => {
    for (const bad of ['=HYPERLINK("http://x")', '+1', '-2', '@SUM(A1)'])
      expect(csvCell(bad).startsWith('"\'')).toBe(true)
  })
})
