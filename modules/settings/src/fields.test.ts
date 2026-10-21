import { describe, expect, it } from 'vitest'
import { publicValues, seasonOptions, sectionSchema, seeds } from './fields.ts'

const parish = (patch: Record<string, { value: string; validated: boolean }>) => ({
  ...seeds.parish,
  ...patch,
})

describe('settings fields', () => {
  it('seeds nothing as validated (research-draft candidates only)', () => {
    for (const section of Object.values(seeds))
      for (const field of Object.values(section)) expect(field.validated).toBe(false)
  })

  it('validates each field kind', () => {
    const schema = sectionSchema('parish')
    expect(
      schema.safeParse(parish({ email: { value: 'secretariat@exemple.cm', validated: true } }))
        .success,
    ).toBe(true)
    expect(
      schema.safeParse(parish({ email: { value: 'pas-une-adresse', validated: false } })).success,
    ).toBe(false)
    expect(
      schema.safeParse(parish({ facebook: { value: 'http://facebook.com/x', validated: false } }))
        .success,
    ).toBe(false)
    expect(
      schema.safeParse(parish({ facebook: { value: 'https://facebook.com/x', validated: false } }))
        .success,
    ).toBe(true)
    expect(
      schema.safeParse(parish({ mapLat: { value: '3.8667', validated: false } })).success,
    ).toBe(true)
    expect(schema.safeParse(parish({ mapLat: { value: 'nord', validated: false } })).success).toBe(
      false,
    )
    const season = sectionSchema('season')
    expect(
      season.safeParse({ ...seeds.season, override: { value: 'avent', validated: false } }).success,
    ).toBe(true)
    expect(
      season.safeParse({ ...seeds.season, override: { value: 'halloween', validated: false } })
        .success,
    ).toBe(false)
  })

  it('shows only validated, non-empty values publicly', () => {
    const out = publicValues({
      parish: parish({
        shortName: { value: 'EEC Nkolndongo 1', validated: true },
        email: { value: 'x@exemple.cm', validated: false },
        bp: { value: '', validated: true },
      }),
    })
    expect(out.parish).toEqual({ shortName: 'EEC Nkolndongo 1' })
  })

  it('applies a season override only until its expiry', () => {
    const today = new Date('2026-10-20T12:00:00Z')
    expect(seasonOptions({ override: 'avent', overrideUntil: '2026-10-31' }, today).override).toBe(
      'avent',
    )
    expect(
      seasonOptions({ override: 'avent', overrideUntil: '2026-10-19' }, today).override,
    ).toBeNull()
    expect(
      seasonOptions({ moissonsStart: '2026-11-01', moissonsEnd: '2026-11-08' }, today).harvest,
    ).toEqual({
      from: '2026-11-01',
      to: '2026-11-08',
    })
    expect(seasonOptions({ moissonsStart: '2026-11-01' }, today).harvest).toBeNull()
  })
})
