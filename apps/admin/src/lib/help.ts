/**
 * The « Aide » guides: Markdown in `apps/admin/help/<lang>/<slug>.md`, loaded one at a time (each guide is its own small
 * chunk). This list gives the order, the titles, and which screen each guide belongs to (for the « ? » in the top bar).
 */
import type { Locale } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'

export type Guide = {
  slug: string
  title: { fr: string; en: string }
  icon: IconName
  /** One line for the card. */
  summary: { fr: string; en: string }
  /** The permission that makes the guide relevant to someone (a guide is listed for everyone, relevant ones first). */
  permission?: string
  /** Admin paths (prefix) where the « ? » leads to this guide. */
  screens?: string[]
}

export const GUIDES: Guide[] = [
  {
    slug: 'campagne-moissons',
    icon: 'gift',
    summary: {
      fr: 'Objectif, sommes saisies puis validées, corbeille publique.',
      en: 'Goal, amounts entered then validated, public basket.',
    },
    title: { fr: 'Suivre la Fête des Moissons', en: 'Follow the Harvest festival' },
    permission: 'campaigns:read',
    screens: ['/m/campaigns'],
  },
  {
    slug: 'inscriptions',
    icon: 'checklist',
    summary: {
      fr: 'Un formulaire par activité, le pointage et la suppression automatique.',
      en: 'One form per activity, check-in and automatic deletion.',
    },
    title: { fr: 'Créer un formulaire d’inscription', en: 'Create a registration form' },
    permission: 'registrations:edit',
    screens: ['/m/registrations'],
  },
  {
    slug: 'publier-actualite',
    icon: 'newspaper',
    summary: {
      fr: 'Écrire, relire et mettre une actualité sur le site.',
      en: 'Write, check and put a news item on the site.',
    },
    title: { fr: 'Publier une actualité', en: 'Publish a news item' },
    permission: 'news:edit',
    screens: ['/m/news'],
  },
  {
    slug: 'sermons',
    icon: 'headphones',
    summary: {
      fr: 'Un titre suffit ; vidéo YouTube et liens (audio sur Drive) en option.',
      en: 'A title is enough; YouTube video and links (audio on Drive) optional.',
    },
    title: { fr: 'Ajouter une prédication', en: 'Add a sermon' },
    permission: 'sermons:edit',
    screens: ['/m/sermons'],
  },
  {
    slug: 'meditations',
    icon: 'book',
    summary: {
      fr: 'Le calendrier de l’année en CSV, puis publié.',
      en: 'The year’s calendar as a CSV, then published.',
    },
    title: { fr: 'Importer le programme de méditation', en: 'Import the meditation programme' },
    permission: 'meditations:edit',
    screens: ['/m/meditations'],
  },
  {
    slug: 'bulletin',
    icon: 'newspaper',
    summary: {
      fr: 'Remplir depuis le site, corriger, publier, imprimer.',
      en: 'Fill from the site, correct, publish, print.',
    },
    title: { fr: 'Composer le bulletin de dimanche', en: 'Compose the Sunday bulletin' },
    permission: 'bulletin:edit',
    screens: ['/m/bulletin'],
  },
  {
    slug: 'programmer-actualite',
    icon: 'calendar',
    summary: {
      fr: 'Écrire maintenant, publier plus tard, à la date choisie.',
      en: 'Write now, publish later at the chosen date.',
    },
    title: { fr: 'Programmer une actualité', en: 'Schedule a news item' },
    permission: 'news:publish',
  },
  {
    slug: 'evenement-recurrent',
    icon: 'refresh',
    summary: {
      fr: 'Un rendez-vous régulier, et annuler une seule date.',
      en: 'A regular meeting, and cancelling a single date.',
    },
    title: { fr: 'Ajouter un événement qui se répète', en: 'Add a repeating event' },
    permission: 'events:edit',
    screens: ['/m/events'],
  },
  {
    slug: 'ce-dimanche',
    icon: 'sun',
    summary: {
      fr: 'Thème, lectures et noms pour le dimanche à venir.',
      en: 'Theme, readings and names for the coming Sunday.',
    },
    title: { fr: 'Remplir « Ce dimanche »', en: 'Fill in "This Sunday"' },
    permission: 'liturgy:edit',
    screens: ['/m/liturgy'],
  },
  {
    slug: 'horaires',
    icon: 'clock',
    summary: {
      fr: 'Mettre à jour les horaires des cultes et rencontres.',
      en: 'Update service and meeting times.',
    },
    title: { fr: 'Mettre à jour les horaires', en: 'Update service times' },
    permission: 'schedule:edit',
    screens: ['/m/schedule'],
  },
  {
    slug: 'page-groupe',
    icon: 'department',
    summary: {
      fr: 'La page publique d’un groupe, avec l’accord des personnes.',
      en: 'A group’s public page, with people’s agreement.',
    },
    title: { fr: 'Modifier la page d’un groupe', en: 'Edit a group page' },
    permission: 'departments:update',
    screens: ['/groups'],
  },
  {
    slug: 'messages',
    icon: 'mail',
    summary: {
      fr: 'Lire, prendre en charge et traiter les messages reçus.',
      en: 'Read, take charge of and handle incoming messages.',
    },
    title: { fr: 'Répondre aux messages reçus', en: 'Answer incoming messages' },
    permission: 'contact:handle',
    screens: ['/m/contact'],
  },
  {
    slug: 'boite-envoi',
    icon: 'mailSend',
    summary: {
      fr: 'Transmettre à la main ce que le site ne peut pas envoyer.',
      en: 'Hand over by yourself what the site cannot send.',
    },
    title: { fr: 'Transmettre un message de la boîte d’envoi', en: 'Relay an outbox message' },
    permission: 'core:system-outbox',
    screens: ['/outbox'],
  },
  {
    slug: 'photos',
    icon: 'photo',
    summary: {
      fr: 'Ajouter des photos avec de bonnes descriptions.',
      en: 'Add photos with good descriptions.',
    },
    title: { fr: 'Ajouter des photos', en: 'Add photos' },
    permission: 'media:upload',
    screens: ['/m/media'],
  },
  {
    slug: 'inviter',
    icon: 'userRoundPlus',
    summary: {
      fr: 'Inviter un collègue avec le bon rôle.',
      en: 'Invite a colleague with the right role.',
    },
    title: { fr: 'Inviter un collègue', en: 'Invite a colleague' },
    permission: 'core:users-invite',
    screens: ['/users'],
  },
  {
    slug: 'valider',
    icon: 'shield',
    summary: {
      fr: 'Ce que « valider » veut dire, et comment faire.',
      en: 'What “validate” means, and how to do it.',
    },
    title: { fr: 'Que veut dire « valider » ?', en: 'What does "validate" mean?' },
    permission: 'core:validation-read',
    screens: ['/validate', '/m/settings'],
  },
]

export const MEMOS: Guide[] = [
  {
    slug: 'memo-editeur',
    icon: 'print',
    summary: {
      fr: 'Les gestes de l’éditeur, sur une page.',
      en: 'The editor’s routine, on one page.',
    },
    title: { fr: 'Éditeur', en: 'Editor' },
    permission: 'news:publish',
  },
  {
    slug: 'memo-secretariat',
    icon: 'print',
    summary: {
      fr: 'Les gestes du secrétariat, sur une page.',
      en: 'The secretariat’s routine, on one page.',
    },
    title: { fr: 'Secrétariat', en: 'Secretariat' },
    permission: 'contact:handle',
  },
  {
    slug: 'memo-responsable',
    icon: 'print',
    summary: {
      fr: 'Les gestes d’un responsable de groupe, sur une page.',
      en: 'A group leader’s routine, on one page.',
    },
    title: { fr: 'Responsable de groupe', en: 'Group leader' },
    permission: 'departments:update',
  },
  {
    slug: 'memo-validateur',
    icon: 'print',
    summary: {
      fr: 'Les gestes du validateur de contenu, sur une page.',
      en: 'The content validator’s routine, on one page.',
    },
    title: { fr: 'Validateur de contenu', en: 'Content validator' },
    permission: 'core:validation-read',
  },
]

const files = import.meta.glob('../../help/*/*.md', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>

/** The Markdown of a guide in a language (falls back to French). */
export async function loadGuide(slug: string, locale: Locale): Promise<string | null> {
  const load = files[`../../help/${locale}/${slug}.md`] ?? files[`../../help/fr/${slug}.md`]
  return load ? load() : null
}

/** The guide for the screen the person is on, if there is one. */
export const guideForPath = (path: string) =>
  GUIDES.find((g) => g.screens?.some((s) => path === s || path.startsWith(`${s}/`)))
