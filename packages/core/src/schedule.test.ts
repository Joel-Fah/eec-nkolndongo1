import { describe, expect, it } from 'vitest'
import { zonedToUtc } from './recurrence.ts'
import { nextService, type Slot, slotProblems, upcomingServices } from './schedule.ts'

const TZ = 'Africa/Douala'
const culte: Slot = {
  id: 'c',
  kind: 'culte',
  labelFr: 'Culte',
  labelEn: 'Service',
  weekday: 0,
  start: '09:00',
  end: '11:00',
}
const priere: Slot = {
  id: 'p',
  kind: 'priere',
  labelFr: 'Prière',
  labelEn: 'Prayer',
  weekday: 3,
  start: '18:00',
  end: null,
}
const at = (y: number, m: number, d: number, h: number, mi = 0) => zonedToUtc(y, m, d, h, mi, TZ)

describe('nextService', () => {
  // 2026-10-21 is a Wednesday.
  it('finds the coming Sunday (« later »), today, tomorrow and « now »', () => {
    expect(nextService([culte], [], at(2026, 10, 21, 10))?.date).toBe('2026-10-25')
    expect(nextService([culte], [], at(2026, 10, 21, 10))?.when).toBe('later')
    expect(nextService([culte], [], at(2026, 10, 24, 10))?.when).toBe('tomorrow')
    expect(nextService([culte], [], at(2026, 10, 25, 7))?.when).toBe('today')
    expect(nextService([culte], [], at(2026, 10, 25, 10))?.when).toBe('now')
    // After the end of Sunday's service, the next is a week later.
    expect(nextService([culte], [], at(2026, 10, 25, 12))?.date).toBe('2026-11-01')
  })
  it('skips a cancelled service and uses changed times and extra gatherings', () => {
    const cancelled = nextService(
      [culte],
      [{ date: '2026-10-25', slotId: 'c', kind: 'cancelled', noteFr: 'x' }],
      at(2026, 10, 21, 10),
    )
    expect(cancelled?.date).toBe('2026-11-01')
    const changed = nextService(
      [culte],
      [{ date: '2026-10-25', slotId: 'c', kind: 'changed', start: '16:00', end: null }],
      at(2026, 10, 21, 10),
    )
    expect(changed?.startsAt.toISOString()).toBe('2026-10-25T15:00:00.000Z')
    expect(changed?.changed).toBe(true)
    const extra = upcomingServices(
      [culte],
      [{ date: '2026-10-22', slotId: null, kind: 'extra', start: '19:00', labelFr: 'Veillée' }],
      at(2026, 10, 21, 10),
      7,
    )
    expect(extra.find((s) => s.extra)?.slot.labelFr).toBe('Veillée')
  })
  it('an « all services that day » exception cancels every slot of the day', () => {
    const s = upcomingServices(
      [culte, { ...priere, weekday: 0 }],
      [{ date: '2026-10-25', slotId: null, kind: 'cancelled' }],
      at(2026, 10, 21, 10),
      7,
    )
    expect(s.filter((x) => x.date === '2026-10-25').every((x) => x.cancelled)).toBe(true)
  })
  it('returns null with no slot of the kind', () => {
    expect(nextService([priere], [], at(2026, 10, 21, 10))).toBeNull()
    expect(nextService([priere], [], at(2026, 10, 21, 10), { kinds: ['priere'] })?.date).toBe(
      '2026-10-21',
    )
  })
})

describe('slotProblems', () => {
  it('checks day, times and order', () => {
    expect(slotProblems({ weekday: 0, start: '09:00', end: '11:00' })).toEqual([])
    expect(slotProblems({ weekday: 7, start: '9h', end: '08:00' })).toEqual([
      'weekday',
      'start',
      'end',
    ])
    expect(slotProblems({ weekday: 1, start: '10:00', end: '10:00' })).toEqual(['end'])
  })
})

describe('monthly slots, anchors and moves', () => {
  // The Holy Supper: the 2nd Sunday of each month at 09:00, and its preparation on the Wednesday before at 17:00.
  const supper: Slot = {
    id: 's',
    kind: 'culte',
    labelFr: 'Sainte Cène',
    labelEn: 'Holy Supper',
    weekday: 0,
    start: '09:00',
    end: null,
    recurrence: { freq: 'monthly', nth: [2] },
  }
  const prep: Slot = {
    id: 'p',
    kind: 'priere',
    labelFr: 'Préparation',
    labelEn: 'Preparation',
    weekday: 3,
    start: '17:00',
    end: null,
    anchorId: 's',
    offsetDays: -4,
  }
  const list = (exc: Parameters<typeof upcomingServices>[1] = []) =>
    upcomingServices([supper, prep], exc, at(2026, 11, 1, 8), 50)
  it('happens only on the 2nd Sunday, and the preparation four days before it', () => {
    const l = list()
    expect(l.filter((x) => x.slot.id === 's').map((x) => x.date)).toEqual([
      '2026-11-08',
      '2026-12-13',
    ])
    expect(l.filter((x) => x.slot.id === 'p').map((x) => x.date)).toEqual([
      '2026-11-04',
      '2026-12-09',
    ])
    expect(l.find((x) => x.slot.id === 'p')?.startsAt.toISOString()).toBe(
      '2026-11-04T16:00:00.000Z',
    )
  })
  it('when the Supper is moved to the 3rd Sunday (with a reason), the preparation follows', () => {
    const l = list([
      {
        date: '2026-11-08',
        slotId: 's',
        kind: 'moved',
        toDate: '2026-11-15',
        noteFr: 'Retraite des pasteurs',
      },
    ])
    const s = l.find((x) => x.slot.id === 's' && x.moved)
    expect(s?.date).toBe('2026-11-15')
    expect(s?.fromDate).toBe('2026-11-08')
    expect(s?.noteFr).toBe('Retraite des pasteurs')
    const p = l.find((x) => x.slot.id === 'p' && x.date === '2026-11-11')
    expect(p?.moved).toBe(true)
    expect(l.some((x) => x.slot.id === 'p' && x.date === '2026-11-04')).toBe(false)
  })
  it('a cancelled Supper cancels its preparation too', () => {
    const l = list([{ date: '2026-12-13', slotId: 's', kind: 'cancelled', noteFr: 'x' }])
    expect(l.filter((x) => x.date === '2026-12-09')[0]?.cancelled).toBe(true)
  })
  it('every 2 weeks', () => {
    const every2: Slot = { ...culte, id: 'e', recurrence: { freq: 'weekly', interval: 2 } }
    const dates = upcomingServices([every2], [], at(2026, 11, 1, 8), 30).map((x) => x.date)
    expect(dates.length).toBe(2)
    expect(
      new Date(`${dates[1]}T00:00:00Z`).getTime() - new Date(`${dates[0]}T00:00:00Z`).getTime(),
    ).toBe(14 * 86_400_000)
  })
  it('next service skips to the monthly one', () => {
    expect(nextService([supper], [], at(2026, 11, 9, 8))?.date).toBe('2026-12-13')
  })
})
