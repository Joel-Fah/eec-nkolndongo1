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
      readings: [{ label: 'ot', ref: 'Amos 4, 1-13' }],
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

import { chapterCount, cleanRef, inRange, verseCount } from './bible.ts'
import {
  checkPassage,
  checkPsalm,
  defaultLabel,
  formatPsalmRef,
  formatStructured,
  parsePsalm,
  parseStructured,
} from './meditation.ts'

describe('chapters and verses exist', () => {
  it('knows how many chapters and verses', () => {
    expect(chapterCount('jhn')).toBe(21)
    expect(chapterCount('psa')).toBe(150)
    expect(verseCount('jhn', 3)).toBe(36)
    expect(verseCount('psa', 119)).toBe(178) // 176 verses + Segond's 2 extra (titles)
    expect(chapterCount('3jn')).toBe(1)
  })
  it('refuses a chapter or verse that does not exist, accepts a, b parts by their number', () => {
    expect(inRange('jhn', 140)).toBe(false)
    expect(inRange('jhn', 3, 16)).toBe(true)
    expect(inRange('jhn', 3, 173)).toBe(false)
    expect(inRange('jhn', 5, '9b')).toBe(true)
    expect(inRange('jhn', 5, '90b')).toBe(false)
    expect(cleanRef({ book: 'jhn', chapter: 140, from: 173, to: 180 })).toBeNull()
    expect(cleanRef({ book: 'jhn', chapter: 3, from: 16 })).not.toBeNull()
  })
})

describe('structured passages', () => {
  it('reads and writes the forms the parish uses, losslessly', () => {
    for (const raw of [
      'Amos 4, 1-13',
      'Jean 7, 53–8, 11',
      'Esaïe 63, 16-19; 64, 2-7',
      'Soph. 1, 14–2,3',
      '3 Jean 1-15',
      'Jean 5, 9b-18',
      'Gen. 15, 1-6; 21, 1-3',
      'Genèse 3',
      '1 Thessaloniciens 1, 5-10',
    ]) {
      const p = parseStructured(raw)
      expect(p, raw).not.toBeNull()
      expect(parseStructured(formatStructured(p as NonNullable<typeof p>)), raw).toEqual(p)
    }
    expect(formatStructured(parseStructured('1 Thessaloniciens 1, 5-10') as never)).toBe(
      '1 Thessaloniciens 1, 5-10',
    )
    expect(formatStructured(parseStructured('3 Jean 1-15') as never)).toBe('3 Jean 1-15')
  })
  it('catches impossible passages with a clear reason', () => {
    expect(checkPassage(parseStructured('Jean 140, 173-180') as never)?.code).toBe('bad_chapter')
    expect(checkPassage(parseStructured('Jean 3, 90') as never)?.code).toBe('bad_verse')
    expect(checkPassage(parseStructured('Jean 3, 16-2') as never)?.code).toBe('bad_order')
    expect(checkPassage(parseStructured('Jean 3, 16') as never)).toBeNull()
  })
  it('the psalm: a number is the whole psalm, number and verses a part', () => {
    expect(parsePsalm('89, 31-47')).toEqual({ psalm: 89, from: 31, to: 47 })
    expect(parsePsalm('64')).toEqual({ psalm: 64, from: null, to: null })
    expect(parsePsalm('1-22')).toBeNull()
    expect(formatPsalmRef({ psalm: 89, from: 31, to: 47 })).toBe('89, 31-47')
    expect(checkPsalm({ psalm: 151, from: null, to: null })?.code).toBe('bad_chapter')
    expect(checkPsalm({ psalm: 23, from: 1, to: 9 })?.code).toBe('bad_verse')
  })
  it('names a reading by its book', () => {
    expect(defaultLabel('amo')).toBe('ot')
    expect(defaultLabel('jhn')).toBe('gospel')
    expect(defaultLabel('rom')).toBe('epistle')
    expect(defaultLabel('rev')).toBe('nt')
  })
})
