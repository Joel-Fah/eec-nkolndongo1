/**
 * Story pages: their structure and animation live in code, their words live in the admin. Each page declares its
 * slots here (key, type, size limit, help text); the admin shows one form per page, in this order, and the public site
 * uses a slot's published value or falls back to the built-in text. This is not a page builder.
 */
export type SlotDef = {
  key: string
  /** `number`: a figure (digits only), the same in both languages, shown with an optional suffix such as « + ». */
  type: 'text' | 'rich' | 'number'
  /** Longest text, in characters (plain text slots). */
  max: number
  label: { fr: string; en: string }
  help: { fr: string; en: string }
  suffix?: string
}
export type PageDef = {
  label: { fr: string; en: string }
  /** The public address in each language, from the site root. */
  path: { fr: string; en: string }
  slots: SlotDef[]
}

const figure = (key: string, fr: string, en: string, suffix?: string): SlotDef => ({
  key,
  type: 'number',
  max: 6,
  suffix,
  label: { fr, en },
  help: {
    fr: 'Un chiffre, seulement quand il est validé. Tant qu’il n’est pas publié, il reste caché sur le site.',
    en: 'A figure, only once validated. Until it is published it stays hidden on the site.',
  },
})

export const PAGE_SLOTS: Record<string, PageDef> = {
  home: {
    label: { fr: 'Accueil', en: 'Home' },
    path: { fr: 'fr/', en: 'en/' },
    slots: [
      {
        key: 'lead',
        type: 'text',
        max: 220,
        label: { fr: 'Phrase d’accueil (sous le titre)', en: 'Welcome line (under the title)' },
        help: {
          fr: 'Remplace la phrase d’accueil par défaut. Pas de fait à valider ici, mais relisez le ton.',
          en: 'Replaces the default welcome line. No fact to validate here, but check the tone.',
        },
      },
      {
        key: 'invite_title',
        type: 'text',
        max: 80,
        label: { fr: 'Carte d’invitation : titre', en: 'Invitation card: title' },
        help: {
          fr: 'La grande carte au-dessus du pied de page, sur toutes les pages.',
          en: 'The large card above the footer, on every page.',
        },
      },
      {
        key: 'invite_text',
        type: 'text',
        max: 240,
        label: { fr: 'Carte d’invitation : texte', en: 'Invitation card: text' },
        help: {
          fr: 'Une ou deux phrases. Ne citez pas d’horaire ici : il vient des horaires validés.',
          en: 'One or two sentences. Do not quote a time here: it comes from the validated schedule.',
        },
      },
      figure(
        'fig_years',
        'Chiffre : années de vie paroissiale',
        'Figure: years of parish life',
        '+',
      ),
      figure('fig_groups', 'Chiffre : groupes et chorales', 'Figure: groups and choirs'),
      figure(
        'fig_sundays',
        'Chiffre : dimanches de culte par an',
        'Figure: Sunday services a year',
      ),
      figure('fig_members', 'Chiffre : membres en lien avec nous', 'Figure: members in touch', '+'),
    ],
  },
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
  trouver: {
    label: { fr: 'Nous trouver', en: 'Find us' },
    path: { fr: 'fr/decouvrir/nous-trouver/', en: 'en/discover/find-us/' },
    slots: [
      {
        key: 'directions',
        type: 'text',
        max: 400,
        label: { fr: 'Comment s’y rendre (en toutes lettres)', en: 'How to get there (in words)' },
        help: {
          fr: 'Remplace le texte d’indication par défaut. À valider avant de publier : c’est une information factuelle.',
          en: 'Replaces the default directions. Validate before publishing: it is factual.',
        },
      },
      {
        key: 'firstvisit',
        type: 'text',
        max: 400,
        label: { fr: 'Pour une première visite', en: 'For a first visit' },
        help: {
          fr: 'Remplace le texte d’accueil par défaut. À valider avant de publier : c’est une information factuelle.',
          en: 'Replaces the default welcome text. Validate before publishing: it is factual.',
        },
      },
      {
        key: 'landmarks',
        type: 'text',
        max: 300,
        label: { fr: 'Repères pour venir', en: 'Landmarks' },
        help: {
          fr: 'Par exemple « près de… ». À valider avant de publier : c’est une information factuelle.',
          en: 'For example “near…”. Validate before publishing: it is a factual detail.',
        },
      },
    ],
  },
  give: {
    label: { fr: 'Donner', en: 'Give' },
    path: { fr: 'fr/donner/', en: 'en/give/' },
    slots: [
      {
        key: 'usage',
        type: 'rich',
        max: 0,
        label: { fr: 'Comment nous utilisons vos dons', en: 'How we use your gifts' },
        help: {
          fr: 'Un court texte de transparence. À valider avant de publier.',
          en: 'A short transparency text. Validate before publishing.',
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
