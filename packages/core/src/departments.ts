/**
 * Departments: the audience tags, the « Où est ta place ? » quiz (questions and the tags each answer points to), and
 * the scoring that turns the answers into one to three suggested groups. Pure, so the browser and the tests share it.
 */
export const DEPARTMENT_TAGS = [
  'jeunes',
  'femmes',
  'hommes',
  'enfants',
  'musique',
  'priere',
  'service',
  'etude',
  'accueil',
] as const
export type DepartmentTag = (typeof DEPARTMENT_TAGS)[number]

export type QuizAnswer = { id: string; textFr: string; textEn: string; tags: string[] }
export type QuizQuestion = { id: string; textFr: string; textEn: string; answers: QuizAnswer[] }
export type Quiz = { questions: QuizQuestion[] }

/** Starting questions; the parish edits them in the admin. They are interface copy, not facts about the parish. */
export const DEFAULT_QUIZ: Quiz = {
  questions: [
    {
      id: 'q1',
      textFr: 'Qu’aimes-tu faire ?',
      textEn: 'What do you enjoy doing?',
      answers: [
        {
          id: 'a1',
          textFr: 'Chanter ou jouer de la musique',
          textEn: 'Singing or playing music',
          tags: ['musique'],
        },
        {
          id: 'a2',
          textFr: 'Prier avec d’autres',
          textEn: 'Praying with others',
          tags: ['priere'],
        },
        { id: 'a3', textFr: 'Rendre service', textEn: 'Helping out', tags: ['service', 'accueil'] },
        { id: 'a4', textFr: 'Étudier la Bible', textEn: 'Studying the Bible', tags: ['etude'] },
      ],
    },
    {
      id: 'q2',
      textFr: 'Avec qui te sens-tu à l’aise ?',
      textEn: 'Who do you feel at ease with?',
      answers: [
        {
          id: 'a1',
          textFr: 'Des jeunes de mon âge',
          textEn: 'Young people my age',
          tags: ['jeunes'],
        },
        { id: 'a2', textFr: 'Des femmes', textEn: 'Women', tags: ['femmes'] },
        { id: 'a3', textFr: 'Des hommes', textEn: 'Men', tags: ['hommes'] },
        { id: 'a4', textFr: 'Des enfants', textEn: 'Children', tags: ['enfants'] },
      ],
    },
    {
      id: 'q3',
      textFr: 'Qu’attends-tu d’abord ?',
      textEn: 'What are you looking for first?',
      answers: [
        { id: 'a1', textFr: 'Rencontrer des gens', textEn: 'Meeting people', tags: ['accueil'] },
        {
          id: 'a2',
          textFr: 'Grandir dans ma foi',
          textEn: 'Growing in my faith',
          tags: ['etude', 'priere'],
        },
        {
          id: 'a3',
          textFr: 'Mettre mes talents au service',
          textEn: 'Putting my gifts to use',
          tags: ['service', 'musique'],
        },
      ],
    },
  ],
}

/** The groups that share the most tags with the chosen answers (at most `max`, never one with nothing in common). */
export function suggestDepartments(
  chosen: string[][],
  pages: { key: string; tags: string[] }[],
  max = 3,
): { key: string; matched: string[] }[] {
  const wanted = new Map<string, number>()
  for (const tags of chosen) for (const t of tags) wanted.set(t, (wanted.get(t) ?? 0) + 1)
  return pages
    .map((p) => {
      const matched = p.tags.filter((t) => wanted.has(t))
      return { key: p.key, matched, score: matched.reduce((n, t) => n + (wanted.get(t) ?? 0), 0) }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, max)
    .map(({ key, matched }) => ({ key, matched }))
}
