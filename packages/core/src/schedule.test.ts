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
