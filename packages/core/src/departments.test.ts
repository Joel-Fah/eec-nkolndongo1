import { describe, expect, it } from 'vitest'
import { DEFAULT_QUIZ, suggestDepartments } from './departments.ts'

describe('suggestDepartments', () => {
  const pages = [
    { key: 'chorale', tags: ['musique', 'priere'] },
    { key: 'jape', tags: ['jeunes', 'service'] },
    { key: 'ufc', tags: ['femmes'] },
  ]
  it('ranks by shared tags and names what matched', () => {
    const r = suggestDepartments([['musique'], ['priere']], pages)
    expect(r[0]).toEqual({ key: 'chorale', matched: ['musique', 'priere'] })
  })
  it('never suggests a group with nothing in common, and caps the list', () => {
    expect(suggestDepartments([['hommes']], pages)).toEqual([])
    expect(suggestDepartments([['musique', 'jeunes', 'femmes']], pages, 2)).toHaveLength(2)
  })
  it('the starting quiz has three questions with tagged answers', () => {
    expect(DEFAULT_QUIZ.questions).toHaveLength(3)
    for (const q of DEFAULT_QUIZ.questions)
      for (const a of q.answers) expect(a.tags.length).toBeGreaterThan(0)
  })
})
