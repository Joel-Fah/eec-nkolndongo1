/**
 * The « Aide » guides: Markdown in `apps/admin/help/<lang>/<slug>.md`, loaded one at a time (each guide is its own small
 * chunk). This list gives the order, the titles, and which screen each guide belongs to (for the « ? » in the top bar).
 */
import type { Locale } from '@eec/i18n'

export type Guide = {
  slug: string
  title: { fr: string; en: string }
  /** The permission that makes the guide relevant to someone (a guide is listed for everyone, relevant ones first). */
  permission?: string
  /** Admin paths (prefix) where the « ? » leads to this guide. */
  screens?: string[]
}

export const GUIDES: Guide[] = [
  {
    slug: 'publier-actualite',
    title: { fr: 'Publier une actualité', en: 'Publish a news item' },
    permission: 'news:edit',
    screens: ['/m/news'],
  },
  {
    slug: 'programmer-actualite',
    title: { fr: 'Programmer une actualité', en: 'Schedule a news item' },
    permission: 'news:publish',
  },
  {
    slug: 'evenement-recurrent',
    title: { fr: 'Ajouter un événement qui se répète', en: 'Add a repeating event' },
    permission: 'events:edit',
    screens: ['/m/events'],
  },
  {
    slug: 'ce-dimanche',
    title: { fr: 'Remplir « Ce dimanche »', en: 'Fill in "This Sunday"' },
    permission: 'liturgy:edit',
    screens: ['/m/liturgy'],
  },
  {
    slug: 'horaires',
    title: { fr: 'Mettre à jour les horaires', en: 'Update service times' },
    permission: 'schedule:edit',
    screens: ['/m/schedule'],
  },
  {
    slug: 'page-groupe',
    title: { fr: 'Modifier la page d’un groupe', en: 'Edit a group page' },
    permission: 'departments:update',
    screens: ['/groups'],
  },
  {
    slug: 'messages',
    title: { fr: 'Répondre aux messages reçus', en: 'Answer incoming messages' },
    permission: 'contact:handle',
    screens: ['/m/contact'],
  },
  {
    slug: 'boite-envoi',
    title: { fr: 'Transmettre un message de la boîte d’envoi', en: 'Relay an outbox message' },
    permission: 'core:system-outbox',
    screens: ['/outbox'],
  },
  {
    slug: 'photos',
    title: { fr: 'Ajouter des photos', en: 'Add photos' },
    permission: 'media:upload',
    screens: ['/m/media'],
  },
  {
    slug: 'inviter',
    title: { fr: 'Inviter un collègue', en: 'Invite a colleague' },
    permission: 'core:users-invite',
    screens: ['/users'],
  },
  {
    slug: 'valider',
    title: { fr: 'Que veut dire « valider » ?', en: 'What does "validate" mean?' },
    permission: 'core:validation-read',
    screens: ['/validate', '/m/settings'],
  },
]

export const MEMOS: Guide[] = [
  { slug: 'memo-editeur', title: { fr: 'Éditeur', en: 'Editor' }, permission: 'news:publish' },
  {
    slug: 'memo-secretariat',
    title: { fr: 'Secrétariat', en: 'Secretariat' },
    permission: 'contact:handle',
  },
  {
    slug: 'memo-responsable',
    title: { fr: 'Responsable de groupe', en: 'Group leader' },
    permission: 'departments:update',
  },
  {
    slug: 'memo-validateur',
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
