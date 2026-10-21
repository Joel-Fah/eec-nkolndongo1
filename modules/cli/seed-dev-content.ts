/**
 * `pnpm content:seed-dev` — DEV ONLY. A handful of clearly fictional posts and events ("Exemple — …") so the layouts can
 * be judged with realistic lengths and photos. No parish facts: no names, dates, times or places. `--clear` removes them.
 * Refuses to run on any branch but `dev`.
 */
import { cleanDoc, nthWeekdayOfMonth, zonedToUtc } from '@eec/core'
import { assertBranch, connectDirect } from '@eec/db/node'
import { groups, mediaFiles } from '@eec/db/schema'
import { departmentPages, departmentPeople } from '@eec/module-departments/schema'
import { eventsItems } from '@eec/module-events/schema'
import { guideSteps, guides } from '@eec/module-guides/schema'
import { liturgySundays, liturgyVerses } from '@eec/module-liturgy/schema'
import { newsPosts } from '@eec/module-news/schema'
import { scheduleExceptions, scheduleSlots } from '@eec/module-schedule/schema'
import { and, eq, like } from 'drizzle-orm'

assertBranch(['dev'])
const { db, close } = await connectDirect()

if (process.argv.includes('--clear')) {
  await db.delete(newsPosts).where(like(newsPosts.slug, 'exemple-%'))
  await db.delete(eventsItems).where(like(eventsItems.slug, 'exemple-%'))
  await db.delete(scheduleExceptions).where(like(scheduleExceptions.noteFr, 'Exemple%'))
  await db.delete(scheduleSlots).where(like(scheduleSlots.labelFr, 'Exemple —%'))
  await db.delete(liturgyVerses).where(eq(liturgyVerses.translationFr, 'LSG'))
  await db.delete(liturgySundays).where(like(liturgySundays.themeFr, 'Exemple%'))
  await db.delete(guides).where(like(guides.slug, 'exemple-%'))
  await db.delete(groups).where(like(groups.key, 'exemple-%')) // their pages and people go with them
  console.log('Example posts, events and groups removed.')
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
// The Holy Supper: every 2nd Sunday of the month, with its preparation on the Wednesday before at 17:00 (it follows the
// Supper). Next month's Supper is moved to the 3rd Sunday « for a reason », and the preparation follows it.
const [supper] = await db
  .insert(scheduleSlots)
  .values({
    kind: 'culte',
    labelFr: 'Exemple — Sainte Cène (2e dimanche)',
    labelEn: 'Example — Holy Supper (2nd Sunday)',
    weekday: 0,
    startTime: '09:00',
    endTime: '11:30',
    recurrence: { freq: 'monthly', nth: [2] },
    validated: true,
  })
  .returning()
if (supper) {
  await db.insert(scheduleSlots).values({
    kind: 'priere',
    labelFr: 'Exemple — Préparation de la Sainte Cène',
    labelEn: 'Example — Holy Supper preparation',
    weekday: 3,
    startTime: '17:00',
    endTime: '18:30',
    anchorSlotId: supper.id,
    offsetDays: -4,
    validated: true,
  })
  const now = new Date()
  const y = now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
  const m = ((now.getUTCMonth() + 1) % 12) + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  const second = nthWeekdayOfMonth(y, m, 2, 0)
  const third = nthWeekdayOfMonth(y, m, 3, 0)
  await db.insert(scheduleExceptions).values({
    date: `${y}-${pad(m)}-${pad(second)}`,
    slotId: supper.id,
    kind: 'moved',
    toDate: `${y}-${pad(m)}-${pad(third)}`,
    noteFr: 'Exemple : retraite des pasteurs ce dimanche-là',
  })
}

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
// The next 2nd Sunday of a month is a Holy Supper Sunday, whatever its season.
{
  const now = new Date()
  for (let i = 0; i < 3; i++) {
    const y = now.getUTCFullYear() + Math.floor((now.getUTCMonth() + i) / 12)
    const m = ((now.getUTCMonth() + i) % 12) + 1
    const d = nthWeekdayOfMonth(y, m, 2, 0)
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (new Date(`${date}T12:00:00Z`) > now) {
      await db
        .insert(liturgySundays)
        .values({
          date,
          holySupper: true,
          themeFr: 'Exemple — Dimanche de la Sainte Cène',
          state: 'published',
          publishedAt: new Date(),
        })
        .onConflictDoNothing()
      break
    }
  }
}
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
// Departments: three fictional groups with published pages; one person has agreed to be named, one has not.
const exGroups = [
  {
    key: 'exemple-chorale',
    nameFr: 'Exemple — Chorale',
    nameEn: 'Example — Choir',
    kind: 'choir' as const,
    tags: ['musique', 'priere'],
    tagline: 'Une phrase d’accroche d’exemple pour la chorale',
  },
  {
    key: 'exemple-jeunes',
    nameFr: 'Exemple — Jeunes',
    nameEn: 'Example — Youth',
    kind: 'department' as const,
    tags: ['jeunes', 'service', 'etude'],
    tagline: 'Une phrase d’accroche d’exemple pour les jeunes',
  },
  {
    key: 'exemple-femmes',
    nameFr: 'Exemple — Femmes',
    nameEn: 'Example — Women',
    kind: 'department' as const,
    tags: ['femmes', 'priere', 'accueil'],
    tagline: 'Une phrase d’accroche d’exemple pour les femmes',
  },
]
for (const [i, g] of exGroups.entries()) {
  const [grp] = await db
    .insert(groups)
    .values({ key: g.key, nameFr: g.nameFr, nameEn: g.nameEn, kind: g.kind })
    .onConflictDoUpdate({
      target: groups.key,
      set: { nameFr: g.nameFr, nameEn: g.nameEn, kind: g.kind },
    })
    .returning()
  if (!grp) continue
  const values = {
    groupId: grp.id,
    state: 'published',
    taglineFr: g.tagline,
    taglineEn: g.tagline.replace('Une phrase d’accroche d’exemple pour', 'An example tagline for'),
    bodyFr: cleanDoc({ type: 'doc', content: [para(lorem)] }),
    meetingFr: 'Rencontre d’exemple, jour et lieu d’exemple',
    tags: g.tags,
    coverMediaId: photos[i]?.id ?? null,
    sortOrder: i,
  }
  const [page] = await db
    .insert(departmentPages)
    .values(values)
    .onConflictDoUpdate({ target: departmentPages.groupId, set: values })
    .returning()
  if (page && i === 0) {
    await db.delete(departmentPeople).where(eq(departmentPeople.pageId, page.id))
    await db.insert(departmentPeople).values([
      {
        pageId: page.id,
        name: 'Exemple — Personne qui a consenti',
        roleFr: 'Responsable',
        roleEn: 'Leader',
        publicConsent: true,
        consentAt: new Date(),
      },
      {
        pageId: page.id,
        name: 'Exemple — Personne sans consentement',
        roleFr: 'Trésorière',
        roleEn: 'Treasurer',
      },
    ])
  }
  if (i === 0)
    await db.insert(scheduleSlots).values({
      kind: 'etude_biblique',
      labelFr: 'Exemple — Répétition',
      labelEn: 'Example — Rehearsal',
      weekday: 6,
      startTime: '16:00',
      groupId: grp.id,
      validated: true,
    })
}
// Guides: the five structures from the brief as empty drafts (wording to be validated), plus one published example.
const structures = [
  ['Le baptême d’un enfant', 'child-baptism', 'Baptism of a child'],
  ['Le baptême d’un adulte et la confirmation', 'adult-baptism', 'Adult baptism and confirmation'],
  ['Le mariage (bénédiction nuptiale)', 'marriage', 'Marriage (nuptial blessing)'],
  ['Le deuil et le service funèbre', 'bereavement', 'Bereavement and funeral service'],
  ['Adhérer à la paroisse', 'joining', 'Joining the parish'],
] as const
for (const [i, [fr, slug, en]] of structures.entries())
  await db
    .insert(guides)
    .values({
      slug: `exemple-${slug}`,
      titleFr: `Exemple — ${fr}`,
      titleEn: `Example — ${en}`,
      sortOrder: i,
      state: 'draft',
    })
    .onConflictDoNothing()
const [demo] = await db
  .insert(guides)
  .values({
    slug: 'exemple-parcours',
    state: 'published',
    icon: 'checklist',
    titleFr: 'Exemple — Un parcours en quatre étapes',
    titleEn: 'Example — A four-step guide',
    introFr:
      'Un parcours d’exemple pour juger la liste à cocher, l’impression et la barre de progression.',
    audienceFr: 'Exemple',
    sortOrder: 9,
  })
  .onConflictDoUpdate({ target: guides.slug, set: { state: 'published' } })
  .returning()
if (demo) {
  await db.delete(guideSteps).where(eq(guideSteps.guideId, demo.id))
  await db.insert(guideSteps).values(
    ['Prendre contact', 'Rassembler les documents', 'Rencontrer l’équipe', 'Confirmer la date'].map(
      (title, i) => ({
        guideId: demo.id,
        sortOrder: i,
        titleFr: `Exemple — ${title}`,
        bodyFr: cleanDoc({ type: 'doc', content: [para(lorem)] }),
        documentsFr: i === 1 ? 'Un document d’exemple\nUn autre document d’exemple' : '',
        durationFr: i === 2 ? 'Environ 30 minutes (exemple)' : '',
        contactFr: i === 0 ? 'Le secrétariat (exemple)' : '',
      }),
    ),
  )
}
console.log(
  `Seeded ${titles.length} example posts (exemple-1…), 3 example events, 3 schedule slots, two Sundays (one a Holy Supper), the Holy Supper rhythm with its preparation and a move, and 3 verses.`,
)
await close()
