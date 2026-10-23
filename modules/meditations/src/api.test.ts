import { readFileSync } from 'node:fs'
import { readMeditationCsv } from '@eec/core'
import { describe, expect, it } from 'vitest'
import { dayBody, importBody, planBody } from './api.ts'

const csv = readFileSync(new URL('../fixtures/meditations-2026.csv', import.meta.url), 'utf8')

describe('the parish calendar for 2026 (real values)', () => {
  const r = readMeditationCsv(csv)
  it('reads every day, July to December; the only error is a real one in the calendar (Hébreux 8, 19 does not exist)', () => {
    const errors = r.issues.filter((i) => i.level === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ code: 'bad_verse' })
    expect(r.rows.find((x) => x.line === errors[0]?.line)?.date).toBe('2026-12-27')
    expect(r.rows.filter((x) => x.valid)).toHaveLength(183)
    expect(r.rows).toHaveLength(184)
    expect(r.rows[0]?.date).toBe('2026-07-01')
    expect(r.rows.at(-1)?.date).toBe('2026-12-31')
  })
  it('knows the shape: one reading on ordinary days, three on Sundays, always a psalm', () => {
    const sundays = r.rows.filter((x) => new Date(`${x.date}T12:00:00Z`).getUTCDay() === 0)
    const christmas = r.rows.find((x) => x.date === '2026-12-25')
    expect(r.rows.every((x) => x.psalm !== '')).toBe(true)
    expect(
      r.rows
        .filter((x) => !sundays.includes(x) && x !== christmas)
        .every((x) => x.readings.length === 1),
    ).toBe(true)
    expect(
      sundays.filter((x) => x.date !== '2026-12-27').every((x) => x.readings.length === 3),
    ).toBe(true)
    expect(r.rows.find((x) => x.date === '2026-11-29')?.headline).toBe('1er Dim. Avent')
  })
  it('recognises every book (nothing to fix by hand)', () => {
    expect(r.issues.filter((i) => i.code === 'unknown_book')).toEqual([])
  })
  it('flags only the two psalm lines that lost their number', () => {
    expect(
      r.issues
        .filter((i) => i.code === 'psalm_without_number')
        .map((i) => r.rows.find((x) => x.line === i.line)?.date),
    ).toEqual(['2026-09-16', '2026-09-17'])
  })
})

describe('meditation input', () => {
  it('a day takes up to three readings and a psalm, nothing else', () => {
    expect(
      dayBody.safeParse({ readings: [{ label: 'gospel', ref: 'Jean 1, 1-5' }], psalm: '23' })
        .success,
    ).toBe(true)
    expect(
      dayBody.safeParse({
        readings: Array.from({ length: 4 }, () => ({ label: 'gospel', ref: 'Jean 1, 1' })),
      }).success,
    ).toBe(false)
    expect(dayBody.safeParse({ readings: [{ label: 'gospel', ref: 'Jean <b> 1' }] }).success).toBe(
      false,
    )
    expect(dayBody.safeParse({ state: 'published' }).success).toBe(false)
  })
  it('an import row needs a real date and something to read', () => {
    expect(
      importBody.safeParse({
        rows: [
          { date: '2026-07-01', readings: [{ label: 'ot', ref: 'Amos 4, 1-13' }], psalm: '89' },
        ],
      }).success,
    ).toBe(true)
    // A passage that does not exist is refused, wherever it comes from.
    expect(
      importBody.safeParse({
        rows: [
          {
            date: '2026-07-01',
            readings: [{ label: 'gospel', ref: 'Jean 140, 173-180' }],
            psalm: '89',
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      importBody.safeParse({
        rows: [
          { date: '2026-07-01', readings: [{ label: 'ot', ref: 'Amos 4, 1-13' }], psalm: '151' },
        ],
      }).success,
    ).toBe(false)
    expect(
      importBody.safeParse({ rows: [{ date: '1/7/2026', readings: [], psalm: '89' }] }).success,
    ).toBe(false)
    expect(
      importBody.safeParse({ rows: [{ date: '2026-07-01', readings: [], psalm: '' }] }).success,
    ).toBe(false)
  })
  it('a programme ends after it starts', () => {
    expect(planBody.safeParse({ startsOn: '2026-01-01', endsOn: '2026-12-31' }).success).toBe(true)
    expect(planBody.safeParse({ startsOn: '2026-12-31', endsOn: '2026-01-01' }).success).toBe(false)
  })
})
