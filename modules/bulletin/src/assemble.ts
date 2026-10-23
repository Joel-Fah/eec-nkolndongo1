/**
 * Auto-assembly of a bulletin draft (admin, in the browser): it reads the SAME public data the site shows (this Sunday, the week's
 * events, the meditations, the recent news), so it can only suggest what is already public, and nothing here reads another
 * module's tables. Staff then edit everything. French and English are filled from the two languages of those sources.
 */
import { api } from '@eec/admin-kit'
import type { BulletinBlock, BulletinItem } from './schema.ts'

type Loc = 'fr' | 'en'
const TZ = 'Africa/Douala'
const id = () => Math.random().toString(36).slice(2, 10)
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dayLabel = (d: string, l: Loc) =>
  cap(
    new Intl.DateTimeFormat(l, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${d}T12:00:00Z`),
    ),
  )

const safe = async <T>(path: string): Promise<T | null> => {
  try {
    return await api<T>(path)
  } catch {
    return null
  }
}

type Sunday = {
  date: string
  name: string
  theme: string
  readings: { label: string }[]
  preacher: string
  hymns: string
  holySupper: boolean
}
type Occ = {
  slug: string
  title: string
  startsAt: string
  allDay: boolean
  location: string
  cancelled: boolean
}
type Med = { date: string; headline: string; readings: { ref: string }[]; psalm: string }
type News = { items: { title: string; excerpt: string; publishedAt: string }[] }

const pair = (
  fr: Partial<BulletinItem> & { titleFr?: string },
  en: Partial<BulletinItem> & { titleEn?: string },
): BulletinItem => ({
  titleFr: fr.titleFr ?? '',
  textFr: fr.textFr ?? '',
  titleEn: en.titleEn ?? '',
  textEn: en.textEn ?? '',
})

export type Assembled = {
  blocks: BulletinBlock[]
  found: { sunday: boolean; agenda: number; meditations: number; announcements: number }
}

export async function assemble(weekOf: string): Promise<Assembled> {
  const end = addDays(weekOf, 6)
  const [sunFr, sunEn, evFr, evEn, newsFr, newsEn] = await Promise.all([
    safe<{ items: Sunday[] }>('/liturgy/public/sundays?locale=fr'),
    safe<{ items: Sunday[] }>('/liturgy/public/sundays?locale=en'),
    safe<{ items: Occ[] }>(`/events/public?locale=fr&from=${weekOf}&to=${end}`),
    safe<{ items: Occ[] }>(`/events/public?locale=en&from=${weekOf}&to=${end}`),
    safe<News>('/news/public?locale=fr&limit=8'),
    safe<News>('/news/public?locale=en&limit=8'),
  ])
  const months = [...new Set([weekOf.slice(0, 7), end.slice(0, 7)])]
  const medFr = (
    await Promise.all(
      months.map((m) => safe<{ days: Med[] }>(`/meditations/public/month?locale=fr&month=${m}`)),
    )
  ).flatMap((r) => r?.days ?? [])
  const medEn = (
    await Promise.all(
      months.map((m) => safe<{ days: Med[] }>(`/meditations/public/month?locale=en&month=${m}`)),
    )
  ).flatMap((r) => r?.days ?? [])
  const blocks: BulletinBlock[] = []

  const sFr = sunFr?.items.find((x) => x.date === weekOf)
  const sEn = sunEn?.items.find((x) => x.date === weekOf)
  if (sFr) {
    const items: BulletinItem[] = []
    items.push(
      pair(
        { titleFr: sFr.name, textFr: sFr.theme },
        { titleEn: sEn?.name ?? '', textEn: sEn?.theme ?? '' },
      ),
    )
    if (sFr.readings.length)
      items.push(
        pair(
          { titleFr: 'Lectures', textFr: sFr.readings.map((r) => r.label).join(' · ') },
          { titleEn: 'Readings', textEn: (sEn?.readings ?? []).map((r) => r.label).join(' · ') },
        ),
      )
    if (sFr.preacher)
      items.push(
        pair(
          { titleFr: 'Prédication', textFr: sFr.preacher },
          { titleEn: 'Preaching', textEn: sFr.preacher },
        ),
      )
    if (sFr.hymns)
      items.push(
        pair({ titleFr: 'Cantiques', textFr: sFr.hymns }, { titleEn: 'Hymns', textEn: sFr.hymns }),
      )
    if (sFr.holySupper)
      items.push(
        pair(
          { titleFr: 'Sainte Cène', textFr: 'Ce dimanche, nous célébrons la Sainte Cène.' },
          { titleEn: 'Holy Supper', textEn: 'This Sunday we celebrate the Holy Supper.' },
        ),
      )
    blocks.push({ id: id(), kind: 'sunday', titleFr: 'Ce dimanche', titleEn: 'This Sunday', items })
  }

  const occs = (evFr?.items ?? []).filter((o) => !o.cancelled)
  const time = (o: Occ, l: Loc) =>
    o.allDay
      ? ''
      : ` · ${new Intl.DateTimeFormat(l, { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(o.startsAt))}`
  const dayOf = (o: Occ) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(o.startsAt))
  const agenda = occs.map((o) => {
    const en = (evEn?.items ?? []).find((x) => x.slug === o.slug && x.startsAt === o.startsAt)
    return pair(
      {
        titleFr: `${dayLabel(dayOf(o), 'fr')}${time(o, 'fr')}`,
        textFr: `${o.title}${o.location ? ` — ${o.location}` : ''}`,
      },
      {
        titleEn: `${dayLabel(dayOf(o), 'en')}${time(o, 'en')}`,
        textEn: `${en?.title ?? o.title}${(en?.location ?? o.location) ? ` — ${en?.location ?? o.location}` : ''}`,
      },
    )
  })
  if (agenda.length)
    blocks.push({
      id: id(),
      kind: 'agenda',
      titleFr: 'Agenda de la semaine',
      titleEn: 'The week ahead',
      items: agenda,
    })

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i))
  const meds = days.flatMap((d) => {
    const f = medFr.find((x) => x.date === d)
    if (!f) return []
    const e = medEn.find((x) => x.date === d)
    const line = (x: Med) => [...x.readings.map((r) => r.ref), x.psalm].filter(Boolean).join(' · ')
    return [
      pair(
        { titleFr: dayLabel(d, 'fr'), textFr: line(f) },
        { titleEn: dayLabel(d, 'en'), textEn: e ? line(e) : '' },
      ),
    ]
  })
  if (meds.length)
    blocks.push({
      id: id(),
      kind: 'meditations',
      titleFr: 'Méditation de la semaine',
      titleEn: 'Meditations of the week',
      items: meds,
    })

  const since = addDays(weekOf, -7)
  const news = (newsFr?.items ?? []).filter((n) => n.publishedAt.slice(0, 10) >= since)
  const ann = news.map((n, i) =>
    pair(
      { titleFr: n.title, textFr: n.excerpt },
      { titleEn: newsEn?.items[i]?.title ?? '', textEn: newsEn?.items[i]?.excerpt ?? '' },
    ),
  )
  if (ann.length)
    blocks.push({
      id: id(),
      kind: 'announcements',
      titleFr: 'Annonces',
      titleEn: 'Announcements',
      items: ann,
    })

  return {
    blocks,
    found: {
      sunday: !!sFr,
      agenda: agenda.length,
      meditations: meds.length,
      announcements: ann.length,
    },
  }
}
