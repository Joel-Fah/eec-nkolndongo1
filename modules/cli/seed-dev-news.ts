/**
 * `pnpm news:seed-dev` — DEV ONLY. A handful of clearly fictional posts ("Exemple — …") so the layouts can be judged
 * with realistic lengths and photos. No parish facts: no names, dates, times or places. `--clear` removes them.
 * Refuses to run on any branch but `dev`.
 */
import { cleanDoc } from '@eec/core'
import { assertBranch, connectDirect } from '@eec/db/node'
import { mediaFiles } from '@eec/db/schema'
import { newsPosts } from '@eec/module-news/schema'
import { and, eq, like } from 'drizzle-orm'

assertBranch(['dev'])
const { db, close } = await connectDirect()

if (process.argv.includes('--clear')) {
  await db.delete(newsPosts).where(like(newsPosts.slug, 'exemple-%'))
  console.log('Example posts removed.')
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
console.log(`Seeded ${titles.length} example posts (slugs exemple-1…).`)
await close()
