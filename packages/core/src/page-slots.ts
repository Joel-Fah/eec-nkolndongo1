/**
 * Story pages: their structure and animation live in code, their words live in the admin. Each page declares its
 * slots here (key, type, size limit, help text); the admin shows one form per page, in this order, and the public site
 * uses a slot's published value or falls back to the built-in text. This is not a page builder.
 */
export type SlotDef = {
  key: string
  type: 'text' | 'rich'
  /** Longest text, in characters (plain text slots). */
  max: number
  label: { fr: string; en: string }
  help: { fr: string; en: string }
}
export type PageDef = {
  label: { fr: string; en: string }
  /** The public address in each language, from the site root. */
  path: { fr: string; en: string }
  slots: SlotDef[]
}

export const PAGE_SLOTS: Record<string, PageDef> = {
  histoire: {
    label: { fr: 'Notre histoire', en: 'Our story' },
    path: { fr: 'fr/decouvrir/notre-histoire/', en: 'en/discover/our-story/' },
    slots: [
      {
        key: 'intro',
        type: 'text',
        max: 400,
        label: { fr: 'Introduction', en: 'Introduction' },
        help: {
          fr: 'Quelques phrases au-dessus de la frise. Les dates et faits doivent être validés.',
          en: 'A few sentences above the timeline. Dates and facts must be validated.',
        },
      },
      {
        key: 'invite',
        type: 'text',
        max: 200,
        label: { fr: 'Fin de parcours (« Et vous ? »)', en: 'Closing line (“And you?”)' },
        help: {
          fr: 'La phrase qui invite à venir, tout en haut de la colline.',
          en: 'The line that invites people to come, at the top of the hill.',
        },
      },
    ],
  },
  croyances: {
    label: { fr: 'Ce que nous croyons', en: 'What we believe' },
    path: { fr: 'fr/decouvrir/ce-que-nous-croyons/', en: 'en/discover/what-we-believe/' },
    slots: [
      {
        key: 'intro',
        type: 'text',
        max: 400,
        label: { fr: 'Introduction', en: 'Introduction' },
        help: { fr: 'Quelques phrases avant le Credo.', en: 'A few sentences before the Creed.' },
      },
    ],
  },
  pasteurs: {
    label: { fr: 'Pasteurs et Conseil', en: 'Pastors and Council' },
    path: { fr: 'fr/decouvrir/pasteurs-et-conseil/', en: 'en/discover/pastors-and-council/' },
    slots: [
      {
        key: 'governance',
        type: 'rich',
        max: 0,
        label: { fr: 'Comment la paroisse est conduite', en: 'How the parish is led' },
        help: {
          fr: 'Montré quand aucun nom n’est public : le rôle de chacun, sans nom.',
          en: 'Shown when no name is public: each role, without names.',
        },
      },
    ],
  },
}

/** The roles on the Pastors and Council page, in the order they appear. */
export const COUNCIL_ROLES = [
  { key: 'pasteur_titulaire', fr: 'Pasteur titulaire', en: 'Senior pastor' },
  { key: 'pasteur_second', fr: 'Pasteur en second', en: 'Associate pastor' },
  { key: 'catechiste', fr: 'Catéchiste', en: 'Catechist' },
  { key: 'anciens', fr: 'Anciens', en: 'Elders' },
  { key: 'diacres', fr: 'Diacres', en: 'Deacons' },
  { key: 'commissions', fr: 'Commissions', en: 'Commissions' },
] as const
export type CouncilRole = (typeof COUNCIL_ROLES)[number]['key']
