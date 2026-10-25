/**
 * The member's own profile (decision 0047): the optional details, what « complete » means, the age band staff see instead of a
 * birth date, the short member code on the card, and the seed of the generated avatar. Pure, tested; no data leaves here.
 */
export const GENDERS = ['woman', 'man'] as const
export type Gender = (typeof GENDERS)[number]
export const MARITAL = ['single', 'married', 'widowed', 'divorced'] as const
export type Marital = (typeof MARITAL)[number]
export const PHOTO_LEVELS = ['private', 'staff'] as const
export type PhotoLevel = (typeof PHOTO_LEVELS)[number]

export type ProfileDetails = {
  birthDate: string | null
  gender: Gender | null
  neighbourhood: string | null
  city: string | null
  maritalStatus: Marital | null
  profession: string | null
}
export const DETAIL_KEYS = [
  'birthDate',
  'gender',
  'neighbourhood',
  'city',
  'maritalStatus',
  'profession',
] as const satisfies readonly (keyof ProfileDetails)[]

export const emptyDetails = (): ProfileDetails => ({
  birthDate: null,
  gender: null,
  neighbourhood: null,
  city: null,
  maritalStatus: null,
  profession: null,
})

/** A real calendar day, not in the future and not before 1900. */
export function validBirthDate(d: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(`${d}T12:00:00Z`)
  return t.toISOString().startsWith(d) && d >= '1900-01-01' && d <= today
}

export const MEMBER_AGE_BANDS = ['under18', '18-25', '26-35', '36-50', '51-65', 'over65'] as const
export type MemberAgeBand = (typeof MEMBER_AGE_BANDS)[number]
export function ageOn(birthDate: string, today: string): number {
  const [by = 0, bm = 0, bd = 0] = birthDate.split('-').map(Number)
  const [ty = 0, tm = 0, td = 0] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}
/** What staff see instead of the birth date. */
export function ageBand(birthDate: string | null, today: string): MemberAgeBand | null {
  if (!birthDate) return null
  const a = ageOn(birthDate, today)
  if (a < 0) return null
  return a < 18
    ? 'under18'
    : a <= 25
      ? '18-25'
      : a <= 35
        ? '26-35'
        : a <= 50
          ? '36-50'
          : a <= 65
            ? '51-65'
            : 'over65'
}

export type Completeness = {
  /** Every step in order, done or not. */
  steps: { key: 'consent' | 'details' | 'photo'; done: boolean; optional: boolean }[]
  /** How many of the six details are filled. */
  filled: number
  total: number
  /** Consent given and every detail filled: nothing left to warn about. The photo is only ever suggested. */
  complete: boolean
}
export function profileCompleteness(
  details: ProfileDetails | null,
  consent: boolean,
  hasPhoto: boolean,
): Completeness {
  const filled = details ? DETAIL_KEYS.filter((k) => !!details[k]).length : 0
  const total = DETAIL_KEYS.length
  return {
    steps: [
      { key: 'consent', done: consent, optional: false },
      { key: 'details', done: consent && filled === total, optional: false },
      { key: 'photo', done: hasPhoto, optional: true },
    ],
    filled,
    total,
    complete: consent && filled === total,
  }
}

const B32 = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
/** A short, stable code for the card (« EEC-7K2M-4Q9X ») derived from the account id: no sequence, nothing that says how many members exist. */
export function memberCode(userId: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (const ch of userId) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0
    h2 = (Math.imul(h2, 31) + ch.charCodeAt(0)) >>> 0
  }
  const pick = (n: number) => B32[n % B32.length]
  const chars = [h1, h1 >>> 5, h1 >>> 10, h1 >>> 15, h2, h2 >>> 5, h2 >>> 10, h2 >>> 15].map(pick)
  return `EEC-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/** A small number to seed the generated avatar from an id. */
export function avatarSeed(userId: string): number {
  let h = 2166136261
  for (const ch of userId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
