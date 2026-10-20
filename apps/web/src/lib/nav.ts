/**
 * Site structure: 5 tabs (docs/product/navigation.md) + utility pages, with localised slugs.
 * One source for the header, the mobile menu, the footer, the language switcher and the routes.
 */
import type { Locale, MessageKey } from '@eec/i18n'
import type { IconName } from '@eec/ui/icons'

type Slugs = Record<Locale, string>

/** `art`: the Storyset illustration shown when this sub-menu item is hovered (packages/ui/illustrations/storyset.json). */
export type NavChild = { id: string; slug: Slugs; icon: IconName; art: string }
export type NavTab = {
  id: 'discover' | 'live' | 'calendar' | 'news' | 'give'
  slug: Slugs
  icon: IconName
  /** Illustration shown in the mega menu (packages/ui/illustrations). */
  art?: string
  children: NavChild[]
}

export const tabs: NavTab[] = [
  {
    id: 'discover',
    icon: 'compass',
    art: 'church',
    slug: { fr: 'decouvrir', en: 'discover' },
    children: [
      {
        id: 'histoire',
        slug: { fr: 'notre-histoire', en: 'our-story' },
        icon: 'hourglass',
        art: 'adventure',
      },
      {
        id: 'croyances',
        slug: { fr: 'ce-que-nous-croyons', en: 'what-we-believe' },
        icon: 'bible',
        art: 'pray',
      },
      {
        id: 'pasteurs',
        slug: { fr: 'pasteurs-et-conseil', en: 'pastors-and-council' },
        icon: 'account',
        art: 'conversation',
      },
      {
        id: 'trouver',
        slug: { fr: 'nous-trouver', en: 'find-us' },
        icon: 'location',
        art: 'destination',
      },
    ],
  },
  {
    id: 'live',
    icon: 'heart',
    art: 'community',
    slug: { fr: 'vivre', en: 'live' },
    children: [
      {
        id: 'cultes',
        slug: { fr: 'cultes-et-horaires', en: 'services-and-times' },
        icon: 'church',
        art: 'music',
      },
      {
        id: 'departements',
        slug: { fr: 'departements', en: 'departments' },
        icon: 'users',
        art: 'community',
      },
      {
        id: 'pratique',
        slug: { fr: 'vie-pratique', en: 'practical-life' },
        icon: 'checklist',
        art: 'family',
      },
    ],
  },
  {
    id: 'calendar',
    icon: 'calendar',
    art: 'events',
    slug: { fr: 'agenda', en: 'calendar' },
    children: [
      {
        id: 'evenements',
        slug: { fr: 'evenements', en: 'events' },
        icon: 'calendar',
        art: 'events',
      },
      {
        id: 'liturgie',
        slug: { fr: 'annee-liturgique', en: 'liturgical-year' },
        icon: 'sun',
        art: 'calendar',
      },
      {
        id: 'moissons',
        slug: { fr: 'fete-des-moissons', en: 'harvest-festival' },
        icon: 'plant',
        art: 'gardening',
      },
    ],
  },
  {
    id: 'news',
    icon: 'newspaper',
    art: 'news',
    slug: { fr: 'actualites', en: 'news' },
    children: [
      { id: 'nouvelles', slug: { fr: 'nouvelles', en: 'latest' }, icon: 'newspaper', art: 'news' },
      {
        id: 'predications',
        slug: { fr: 'predications', en: 'sermons' },
        icon: 'headphones',
        art: 'chatting',
      },
      {
        id: 'meditations',
        slug: { fr: 'meditations-et-bulletin', en: 'meditations-and-bulletin' },
        icon: 'book',
        art: 'book-lover',
      },
    ],
  },
  { id: 'give', slug: { fr: 'donner', en: 'give' }, icon: 'gift', children: [] },
]

/** Pages outside the tabs. */
export const utilityPages: { id: string; slug: Slugs }[] = [
  { id: 'account', slug: { fr: 'mon-espace', en: 'my-space' } },
  { id: 'privacy', slug: { fr: 'confidentialite', en: 'privacy' } },
  { id: 'legal', slug: { fr: 'mentions-legales', en: 'legal' } },
]

export type PageEntry = {
  /** Message key prefix: nav.items.<id> */
  id: string
  /** Path segments per locale, without the locale prefix. */
  path: Slugs
  /** Parent tab id, for the active state. */
  tab?: NavTab['id']
}

/** Every placeholder page in the site. */
export const pages: PageEntry[] = [
  ...tabs.flatMap((tab) =>
    tab.children.length
      ? tab.children.map((child) => ({
          id: child.id,
          tab: tab.id,
          path: { fr: `${tab.slug.fr}/${child.slug.fr}`, en: `${tab.slug.en}/${child.slug.en}` },
        }))
      : [{ id: tab.id === 'give' ? 'give' : tab.id, tab: tab.id, path: tab.slug }],
  ),
  ...utilityPages.map((page) => ({ id: page.id, path: page.slug })),
]

export const href = (locale: Locale, path: string) => `/${locale}/${path}${path ? '/' : ''}`

/** The same page in another locale (home → home). `current` is Astro.url.pathname. */
export function alternates(pathname: string): Record<Locale, string> {
  const [, , ...rest] = pathname.split('/')
  const segments = rest.filter(Boolean).join('/')
  const entry = pages.find((page) => page.path.fr === segments || page.path.en === segments)
  if (entry) return { fr: href('fr', entry.path.fr), en: href('en', entry.path.en) }
  return { fr: href('fr', segments), en: href('en', segments) }
}

export const labelKey = (id: string) => `nav.items.${id}.label` as MessageKey
export const descKey = (id: string) => `nav.items.${id}.desc` as MessageKey
export const tabKey = (id: NavTab['id']) =>
  `nav.${id === 'discover' ? 'discover' : id}` as MessageKey
