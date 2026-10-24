/** Schema.org builders for the JSON-LD blocks (Church, NewsArticle, Event, BreadcrumbList). Facts only when validated. */
import type { Locale } from '@eec/i18n'

type Ld = Record<string, unknown>
const abs = (site: URL | string, path: string) => new URL(path, site).href

export const organization = (site: URL | string, name: string): Ld => ({
  '@type': 'Church',
  '@id': abs(site, '/#church'),
  name,
  url: abs(site, '/'),
  logo: abs(site, '/icon-512.png'),
})

export type ParishFacts = {
  address?: string
  phones?: string
  email?: string
  facebook?: string
  youtube?: string
  mapLat?: string
  mapLng?: string
}

/** The Church with its validated contact details (the public settings only contain approved values). */
export function church(site: URL | string, name: string, p: ParishFacts): Ld {
  const sameAs = [p.facebook, p.youtube].filter((u): u is string => !!u?.startsWith('https://'))
  const lat = Number(p.mapLat)
  const lng = Number(p.mapLng)
  return {
    ...organization(site, name),
    ...(p.address && {
      address: { '@type': 'PostalAddress', streetAddress: p.address, addressCountry: 'CM' },
    }),
    ...(p.phones && { telephone: p.phones.split(/[,;/]/)[0]?.trim() }),
    ...(p.email && { email: p.email }),
    ...(p.mapLat && p.mapLng && Number.isFinite(lat) && Number.isFinite(lng)
      ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } }
      : {}),
    ...(sameAs.length && { sameAs }),
  }
}

export const breadcrumbs = (site: URL | string, items: { name: string; path: string }[]): Ld => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: abs(site, it.path),
  })),
})

export function newsArticle(
  site: URL | string,
  a: {
    url: string
    title: string
    description: string
    publishedAt: string
    locale: Locale
    image?: string
    publisher: string
  },
): Ld {
  return {
    '@type': 'NewsArticle',
    mainEntityOfPage: a.url,
    headline: a.title.slice(0, 110),
    ...(a.description && { description: a.description }),
    datePublished: a.publishedAt,
    inLanguage: a.locale,
    ...(a.image && { image: [a.image] }),
    publisher: { '@id': abs(site, '/#church') },
    author: { '@type': 'Organization', name: a.publisher },
  }
}

export function event(
  site: URL | string,
  e: {
    url: string
    name: string
    description: string
    startsAt: string
    endsAt: string | null
    cancelled: boolean
    locale: Locale
    location: string
    image?: string
    organizer: string
  },
): Ld {
  return {
    '@type': 'Event',
    '@id': e.url,
    url: e.url,
    name: e.name,
    ...(e.description && { description: e.description }),
    startDate: e.startsAt,
    ...(e.endsAt && { endDate: e.endsAt }),
    eventStatus: e.cancelled
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: e.locale,
    ...(e.location && { location: { '@type': 'Place', name: e.location } }),
    ...(e.image && { image: [e.image] }),
    organizer: { '@id': abs(site, '/#church') },
  }
}
