import { describe, expect, it } from 'vitest'
import {
  bookFromToken,
  formatPassage,
  formatPsalm,
  parsePassage,
  readMeditationCsv,
} from './meditation.ts'

describe('passages as the parish prints them', () => {
  it('finds the book from full names and from the short forms the calendar uses', () => {
    for (const [token, id] of [
      ['Amos', 'amo'],
      ['Esaïe', 'isa'],
      ['Ezéchiel', 'ezk'],
      ['Soph.', 'zep'],
      ['Hab.', 'hab'],
      ['Eccles.', 'ecc'],
      ['Apoc.', 'rev'],
      ['Philip.', 'php'],
      ['1 Thess.', '1th'],
      ['1 Thessaloniciens', '1th'],
      ['2 Pierre', '2pe'],
      ['Gen.', 'gen'],
      ['3 Jean', '3jn'],
      ['Jean', 'jhn'],
      ['1 Jean', '1jn'],
      ['Matthieu', 'mat'],
    ] as const)
      expect(bookFromToken(token), token).toBe(id)
  })
  it('does not guess when it is ambiguous or unknown', () => {
    expect(bookFromToken('Ez')).toBeNull()
    expect(bookFromToken('Zzz')).toBeNull()
  })
  it('splits the book from the numbers, including a leading number and whole-chapter references', () => {
    expect(parsePassage('Amos 4, 1-13')).toMatchObject({ book: 'amo', tail: '4, 1-13' })
    expect(parsePassage('3 Jean 1-15')).toMatchObject({ book: '3jn', tail: '1-15' })
    expect(parsePassage('Jean 7, 53–8, 11').tail).toBe('7, 53–8, 11')
    expect(parsePassage('Esaïe 63, 16-19; 64, 2-7').tail).toBe('63, 16-19; 64, 2-7')
  })
  it('shows them in the visitor’s language (verses with a colon in English)', () => {
    expect(formatPassage('Amos 4, 1-13', 'fr')).toBe('Amos 4, 1-13')
    expect(formatPassage('Amos 4, 1-13', 'en')).toBe('Amos 4:1-13')
    expect(formatPassage('Esaïe 63, 16-19; 64, 2-7', 'en')).toBe('Isaiah 63:16-19; 64:2-7')
    expect(formatPassage('Soph. 1, 14–2,3', 'en')).toBe('Zephaniah 1:14–2:3')
    expect(formatPassage('Inconnu 3, 1', 'en')).toBe('Inconnu 3:1')
    expect(formatPsalm('89, 31-47', 'fr')).toBe('Psaume 89, 31-47')
    expect(formatPsalm('89, 31-47', 'en')).toBe('Psalm 89:31-47')
  })
})

const HEADER =
  'Date,Day,Headline,Reading 1 Label,Reading 1 Ref,Reading 2 Label,Reading 2 Ref,Reading 3 Label,Reading 3 Ref,Psalm,Reflection Theme / Meditations,Status / Completion'
describe('the calendar CSV', () => {
  it('reads an ordinary day (one reading and a psalm) and a Sunday (three readings and a psalm)', () => {
    const r = readMeditationCsv(`${HEADER}
2026-07-01,Mercredi,,,"Amos 4, 1-13",,,,,"89, 31-47","Un thème",Completed
2026-07-05,Dimanche,,Ancien Testament,"Zacharie 9, 9-10",Épître,"Romains 8, 9-13",Évangile,"Matthieu 11, 25-30",145,"Le repos",Completed
2026-11-29,Dimanche,1er Dim. Avent,Ancien Testament,"Esaïe 63, 16-19; 64, 2-7",Épître,"1 Corinthiens 1, 3-9",Évangile,"Marc 13, 33-37",80,x,Pending`)
    expect(r.issues).toEqual([])
    expect(r.ignored).toEqual(['Day', 'Reflection Theme / Meditations', 'Status / Completion'])
    expect(r.rows).toHaveLength(3)
    expect(r.rows[0]).toMatchObject({
      date: '2026-07-01',
      psalm: '89, 31-47',
      readings: [{ label: '', ref: 'Amos 4, 1-13' }],
    })
    expect(r.rows[1]?.readings.map((x) => x.label)).toEqual(['ot', 'epistle', 'gospel'])
    expect(r.rows[2]?.headline).toBe('1er Dim. Avent')
  })
  it('reports each problem with its line: bad date, duplicate, empty day, odd psalm, unknown book', () => {
    const r = readMeditationCsv(`${HEADER}
2026-02-30,Jeudi,,,"Amos 4, 1-13",,,,,"89",,
2026-07-01,Mercredi,,,"Amos 4, 1-13",,,,,"89",,
2026-07-01,Mercredi,,,"Amos 5, 1-17",,,,,64,,
2026-07-02,Jeudi,,,,,,,,,,
2026-09-16,Mercredi,,,"Eccles. 1, 1-18",,,,,1-22,,
2026-09-17,Jeudi,,,"Livrex 2, 1",,,,,23,,`)
    const by = (code: string) => r.issues.filter((i) => i.code === code)
    expect(by('bad_date')[0]?.line).toBe(2)
    expect(by('duplicate_date')[0]?.line).toBe(4)
    expect(by('empty_day')[0]?.line).toBe(5)
    expect(by('psalm_without_number')[0]).toMatchObject({ line: 6, level: 'warning' })
    expect(by('unknown_book')[0]).toMatchObject({ line: 7, level: 'warning' })
  })
  it('refuses a file without the expected columns', () => {
    expect(readMeditationCsv('a,b\n1,2').issues[0]?.code).toBe('bad_header')
  })
})
