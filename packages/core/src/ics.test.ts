import { describe, expect, it } from 'vitest'
import { buildIcs, escapeText, fold, rrule } from './ics.ts'
import { zonedToUtc } from './recurrence.ts'

const TZ = 'Africa/Douala'
const start = zonedToUtc(2026, 11, 1, 9, 0, TZ)
const base = {
  id: 'e1',
  title: 'Culte, « du dimanche »; avec\nretour',
  startsAt: start,
  endsAt: new Date(start.getTime() + 7_200_000),
  allDay: false,
  timezone: TZ,
  recurrence: null,
  exceptions: [],
}
const now = new Date('2026-10-21T10:00:00Z')

describe('text and folding', () => {
  it('escapes text values', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b;c\\\\d\\ne')
  })
  it('folds at 75 octets without splitting a character', () => {
    const line = `SUMMARY:${'é'.repeat(60)}`
    const folded = fold(line).split('\r\n')
    expect(folded.length).toBeGreaterThan(1)
    for (const l of folded) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(line)
  })
})

describe('rrule', () => {
  it('weekly, nth weekday, month day; COUNT or UNTIL (UTC) but never both', () => {
    expect(rrule({ freq: 'weekly', byDay: [0, 3] }, TZ)).toBe('FREQ=WEEKLY;BYDAY=SU,WE')
    expect(rrule({ freq: 'monthly', mode: 'nthWeekday', nth: -1, weekday: 6, count: 5 }, TZ)).toBe(
      'FREQ=MONTHLY;BYDAY=-1SA;COUNT=5',
    )
    expect(rrule({ freq: 'monthly', mode: 'monthday', day: 15, interval: 2 }, TZ)).toBe(
      'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15',
    )
    expect(rrule({ freq: 'weekly', byDay: [0], until: '2026-12-31' }, TZ)).toBe(
      'FREQ=WEEKLY;BYDAY=SU;UNTIL=20261231T225959Z',
    )
    expect(rrule({ freq: 'weekly', byDay: [0], count: 3, until: '2026-12-31' }, TZ)).not.toMatch(
      /UNTIL/,
    )
  })
})

describe('buildIcs', () => {
  it('writes a valid calendar with a time zone, CRLF and required properties', () => {
    const ics = buildIcs({ name: 'Agenda', events: [base], now })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/)
    expect(ics).toContain('TZID:Africa/Douala')
    expect(ics).toContain('TZOFFSETTO:+0100')
    expect(ics).toContain('UID:e1@eec-nkolndongo1')
    expect(ics).toContain('DTSTAMP:20261021T100000Z')
    expect(ics).toContain('DTSTART;TZID=Africa/Douala:20261101T090000')
    expect(ics).toContain('DTEND;TZID=Africa/Douala:20261101T110000')
    expect(ics).toContain('SUMMARY:Culte\\, « du dimanche »; avec\\nretour')
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1)
  })
  it('recurring event: RRULE, EXDATE for a cancelled date, override for a moved one', () => {
    const ics = buildIcs({
      name: 'Agenda',
      now,
      events: [
        {
          ...base,
          recurrence: { freq: 'weekly', byDay: [0], count: 10 },
          exceptions: [
            { date: '2026-11-08', kind: 'cancelled', noteFr: 'Annulé' },
            { date: '2026-11-15', kind: 'moved', startsAt: '2026-11-15T15:00:00.000Z' },
          ],
        },
      ],
    })
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU;COUNT=10')
    expect(ics).toContain('EXDATE;TZID=Africa/Douala:20261108T090000')
    expect(ics).toContain('RECURRENCE-ID;TZID=Africa/Douala:20261115T090000')
    expect(ics).toContain('DTSTART;TZID=Africa/Douala:20261115T160000')
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2)
  })
  it('starts a series on its first real occurrence when DTSTART does not fit the rule', () => {
    // Saturday 24 Oct 2026 typed as the start of « the 1st Sunday of the month »: the series starts Sunday 1 Nov.
    const wrong = zonedToUtc(2026, 10, 24, 15, 0, TZ)
    const ics = buildIcs({
      name: 'x',
      now,
      events: [
        {
          ...base,
          startsAt: wrong,
          endsAt: null,
          recurrence: { freq: 'monthly', mode: 'nthWeekday', nth: 1, weekday: 0 },
        },
      ],
    })
    expect(ics).toContain('DTSTART;TZID=Africa/Douala:20261101T150000')
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYDAY=1SU')
  })
  it('all-day events use dates, with an exclusive end', () => {
    const day = new Date(Date.UTC(2026, 11, 25))
    const ics = buildIcs({
      name: 'x',
      now,
      events: [{ ...base, allDay: true, startsAt: day, endsAt: null }],
    })
    expect(ics).toContain('DTSTART;VALUE=DATE:20261225')
    expect(ics).toContain('DTEND;VALUE=DATE:20261226')
    expect(ics).not.toContain('BEGIN:VTIMEZONE')
  })
  it('no line is longer than 75 octets', () => {
    const ics = buildIcs({
      name: 'Agenda',
      now,
      events: [{ ...base, description: 'très long '.repeat(40) }],
    })
    for (const l of ics.split('\r\n'))
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
  })
})
