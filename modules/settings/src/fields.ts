/**
 * The settings sections and their fields, shared by the API (validation) and the admin (form).
 * Nothing here is a parish fact: seeds are research-draft candidates marked unvalidated (docs/content),
 * and an unvalidated value is never shown publicly.
 */
import { SEASONS, type Season } from '@eec/core'
import { z } from 'zod'

export type FieldKind = 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'date' | 'number' | 'season'
export type FieldDef = { key: string; kind: FieldKind; max?: number }
export type SectionId = 'parish' | 'season'

export const sections: Record<SectionId, FieldDef[]> = {
  parish: [
    { key: 'nameFr', kind: 'text', max: 120 },
    { key: 'nameEn', kind: 'text', max: 120 },
    { key: 'shortName', kind: 'text', max: 60 },
    { key: 'address', kind: 'textarea', max: 300 },
    { key: 'bp', kind: 'text', max: 40 },
    { key: 'phones', kind: 'tel', max: 120 },
    { key: 'email', kind: 'email', max: 120 },
    { key: 'whatsapp', kind: 'text', max: 200 },
    { key: 'facebook', kind: 'url', max: 300 },
    { key: 'youtube', kind: 'url', max: 300 },
    { key: 'mapLat', kind: 'number' },
    { key: 'mapLng', kind: 'number' },
  ],
  season: [
    { key: 'moissonsStart', kind: 'date' },
    { key: 'moissonsEnd', kind: 'date' },
    { key: 'override', kind: 'season' },
    { key: 'overrideUntil', kind: 'date' },
  ],
}

export type FieldValue = { value: string; validated: boolean }
export type SectionValues = Record<string, FieldValue>

const date = /^\d{4}-\d{2}-\d{2}$/
const valueSchema = (f: FieldDef) => {
  const empty = z.literal('')
  switch (f.kind) {
    case 'email':
      return z.union([empty, z.email().max(f.max ?? 200)])
    case 'url':
      return z.union([empty, z.url({ protocol: /^https$/ }).max(f.max ?? 300)])
    case 'date':
      return z.union([empty, z.string().regex(date)])
    case 'number':
      return z.union([empty, z.string().regex(/^-?\d{1,3}(\.\d{1,7})?$/)])
    case 'season':
      return z.union([empty, z.enum(SEASONS)])
    default:
      return z
        .string()
        .trim()
        .max(f.max ?? 200)
  }
}

/** Zod schema for one section's PUT body. */
export const sectionSchema = (id: SectionId) =>
  z.object(
    Object.fromEntries(
      sections[id].map((f) => [f.key, z.object({ value: valueSchema(f), validated: z.boolean() })]),
    ),
  )

/** Research-draft candidates (docs/content/README.md): all unvalidated. Empty when we know nothing. */
export const seeds: Record<SectionId, SectionValues> = {
  parish: Object.fromEntries(sections.parish.map((f) => [f.key, { value: '', validated: false }])),
  season: Object.fromEntries(sections.season.map((f) => [f.key, { value: '', validated: false }])),
}
Object.assign(seeds.parish, {
  nameFr: { value: 'Paroisse de Nkolndongo 1', validated: false },
  address: { value: 'Rue 4.032, Yaoundé 4e', validated: false },
  bp: { value: 'BP 110', validated: false },
  email: { value: 'eecnkolndongo@yahoo.fr', validated: false },
})

/** What the public site may show: validated values only. */
export function publicValues(all: Partial<Record<SectionId, SectionValues>>) {
  return Object.fromEntries(
    Object.entries(all).map(([section, values]) => [
      section,
      Object.fromEntries(
        Object.entries(values ?? {})
          .filter(([, v]) => v.validated && v.value !== '')
          .map(([k, v]) => [k, v.value]),
      ),
    ]),
  ) as Partial<Record<SectionId, Record<string, string>>>
}

/** Season settings → options for `getSeason()`: harvest range when both dates are set; override until its expiry. */
export function seasonOptions(season: Record<string, string> | undefined, today = new Date()) {
  const iso = today.toISOString().slice(0, 10)
  const from = season?.moissonsStart
  const to = season?.moissonsEnd
  const override =
    season?.override && (!season.overrideUntil || season.overrideUntil >= iso)
      ? season.override
      : null
  return {
    harvest: from && to ? { from, to } : null,
    override: override as Season | null,
  }
}
