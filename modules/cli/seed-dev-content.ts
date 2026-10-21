/**
 * `pnpm content:seed-dev` — DEV ONLY. A handful of clearly fictional posts and events ("Exemple — …") so the layouts can
 * be judged with realistic lengths and photos. No parish facts: no names, dates, times or places. `--clear` removes them.
 * Refuses to run on any branch but `dev`.
 */
import { cleanDoc, zonedToUtc } from '@eec/core'
import { assertBranch, connectDirect } from '@eec/db/node'
import { mediaFiles } from '@eec/db/schema'
import { eventsItems } from '@eec/module-events/schema'
import { liturgySundays, liturgyVerses } from '@eec/module-liturgy/schema'
import { newsPosts } from '@eec/module-news/schema'
import { scheduleSlots } from '@eec/module-schedule/schema'
import { and, eq, like } from 'drizzle-orm'

assertBranch(['dev'])
const { db, close } = await connectDirect()

if (process.argv.includes('--clear')) {
  await db.delete(newsPosts).where(like(newsPosts.slug, 'exemple-%'))
  await db.delete(eventsItems).where(like(eventsItems.slug, 'exemple-%'))
  await db.delete(scheduleSlots).where(like(scheduleSlots.labelFr, 'Exemple —%'))
  await db.delete(liturgyVerses).where(eq(liturgyVerses.translationFr, 'LSG'))
  await db.delete(liturgySundays).where(eq(liturgySundays.themeFr, 'Exemple de thème'))
  console.log('Example posts and events removed.')
  await close()
  process.exit(0)
}

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const lorem =
  'Ceci est un texte d’exemple pour juger la mise en page : la longueur des lignes, l’espace entre les paragraphes et la lisibilité sur un téléphone. Il ne dit rien sur la paroisse.'
const photos = await db
  .select({ id: mediaFiles.id })
  .from(mediaFiles)
  .where(and(eq(mediaFiles.status, 'ready'), eq(mediaFiles.kind, 'image')))
  .limit(8)
const titles = [
  'Exemple — Un message de bienvenue',
  'Exemple — Une annonce courte',
  'Exemple — Un compte rendu plus long, avec plusieurs paragraphes et une citation',
  'Exemple — Une invitation',
  'Exemple — Une nouvelle sans photo',
]
for (const [i, title] of titles.entries()) {
  const body = cleanDoc({
    type: 'doc',
    content: [
      para(lorem),
      ...(i === 2
        ? [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Un intertitre' }],
            },
            para(`${lorem} ${lorem}`),
            { type: 'blockquote', content: [para('Une citation d’exemple, sans auteur réel.')] },
            {
              type: 'bulletList',
              content: [1, 2, 3].map((n) => ({
                type: 'listItem',
                content: [para(`Point d’exemple ${n}`)],
              })),
            },
            para(lorem),
          ]
        : []),
    ],
  })
  await db
    .insert(newsPosts)
    .values({
      slug: `exemple-${i + 1}`,
      state: 'published',
      firstPublishedAt: new Date(Date.now() - i * 86_400_000 * 3),
      publishAt: new Date(Date.now() - i * 86_400_000 * 3),
      pinned: i === 0,
      titleFr: title,
      excerptFr: i === 1 ? '' : 'Un résumé d’exemple en une phrase, pour la liste.',
      bodyFr: body,
      coverMediaId: i === 4 ? null : (photos[i]?.id ?? null),
    })
    .onConflictDoNothing()
}
// Events: dates are generic (no real parish times). The Sundays/Wednesdays are placeholders to see recurrence.
const TZ = 'Africa/Douala'
const next = (weekday: number, hh: number, mm = 0) => {
  const d = new Date()
  const add = (weekday - d.getUTCDay() + 7) % 7 || 7
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate() + add, hh, mm, TZ)
}
const sun = next(0, 9)
const published = {
  state: 'published',
  firstPublishedAt: new Date(),
  publishAt: new Date(Date.now() - 86_400_000),
} as const
const dateKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
await db
  .insert(eventsItems)
  .values([
    {
      slug: 'exemple-evenement-hebdomadaire',
      ...published,
      titleFr: 'Exemple — Rencontre chaque dimanche',
      descriptionFr: cleanDoc({ type: 'doc', content: [para(lorem)] }),
      startsAt: sun,
      endsAt: new Date(sun.getTime() + 2 * 3_600_000),
      recurrence: { freq: 'weekly', byDay: [0], count: 12 },
      // The second occurrence is cancelled, the third moved a few hours later.
      exceptions: [
        {
          date: dateKey(new Date(sun.getTime() + 7 * 86_400_000)),
          kind: 'cancelled',
          noteFr: 'Exemple d’annulation',
        },
        {
          date: dateKey(new Date(sun.getTime() + 14 * 86_400_000)),
          kind: 'moved',
          startsAt: new Date(sun.getTime() + 14 * 86_400_000 + 6 * 3_600_000).toISOString(),
          noteFr: 'Exemple de déplacement',
        },
      ],
      featured: true,
      kind: 'reunion',
      locationFr: 'Salle d’exemple',
    },
    {
      slug: 'exemple-evenement-mensuel',
      ...published,
      titleFr: 'Exemple — Le premier samedi du mois',
      startsAt: next(6, 15),
      recurrence: { freq: 'monthly', mode: 'nthWeekday', nth: 1, weekday: 6 },
      kind: 'etude',
      locationKind: 'other',
      locationFr: 'Lieu d’exemple',
    },
    {
      slug: 'exemple-evenement-unique',
      ...published,
      titleFr: 'Exemple — Une journée spéciale',
      titleEn: 'Example — A special day',
      descriptionFr: cleanDoc({ type: 'doc', content: [para(lorem), para(lorem)] }),
      startsAt: new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() + 20,
        ),
      ),
      allDay: true,
      kind: 'fete',
    },
    {
      slug: 'exemple-retraite-sur-trois-jours',
      ...published,
      titleFr: 'Exemple — Retraite sur trois jours',
      startsAt: new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() + 12,
        ),
      ),
      endsAt: new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() + 14,
        ),
      ),
      allDay: true,
      kind: 'retraite',
    },
  ])
  .onConflictDoNothing()
// Schedule: obviously fictional slots, already approved so the pages can be judged.
await db.insert(scheduleSlots).values([
  {
    kind: 'culte',
    labelFr: 'Exemple — Culte du dimanche',
    labelEn: 'Example — Sunday service',
    weekday: 0,
    startTime: '09:00',
    endTime: '11:00',
    placeFr: 'Lieu d’exemple',
    validated: true,
  },
  {
    kind: 'priere',
    labelFr: 'Exemple — Prière du mercredi',
    labelEn: 'Example — Wednesday prayer',
    weekday: 3,
    startTime: '18:00',
    validated: true,
  },
  {
    kind: 'etude_biblique',
    labelFr: 'Exemple — Étude biblique',
    labelEn: 'Example — Bible study',
    weekday: 5,
    startTime: '17:30',
    endTime: '19:00',
    validated: true,
  },
])
// Liturgy: the coming Sunday (theme and readings are examples), and the four verses already used on the sign-in screen
// (Louis Segond 1910 / World English Bible, public domain: to check against a printed copy, decision 0032).
const sundayDate = (() => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7))
  return d.toISOString().slice(0, 10)
})()
await db
  .insert(liturgySundays)
  .values({
    date: sundayDate,
    themeFr: 'Exemple de thème',
    themeEn: 'Example theme',
    readings: [
      { book: 'jhn', chapter: 3, from: 16, to: null },
      { book: 'psa', chapter: 23 },
    ],
    state: 'published',
    publishedAt: new Date(),
  })
  .onConflictDoNothing()
await db.insert(liturgyVerses).values([
  {
    ref: { book: 'mat', chapter: 11, from: 28 },
    textFr: 'Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.',
    textEn: 'Come to me, all you who labor and are heavily burdened, and I will give you rest.',
  },
  {
    ref: { book: 'psa', chapter: 23, from: 1 },
    textFr: 'L’Éternel est mon berger : je ne manquerai de rien.',
    textEn: 'Yahweh is my shepherd: I shall lack nothing.',
  },
  {
    ref: { book: 'jhn', chapter: 3, from: 16 },
    textFr:
      'Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle.',
    textEn:
      'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.',
  },
])
console.log(
  `Seeded ${titles.length} example posts (exemple-1…), 3 example events, 3 schedule slots, a Sunday and 3 verses.`,
)
await close()
