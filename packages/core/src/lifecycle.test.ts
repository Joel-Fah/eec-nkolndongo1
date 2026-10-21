import { describe, expect, it } from 'vitest'
import { publishProblems, statusOf, uniqueSlug } from './lifecycle.ts'

const now = new Date('2026-10-21T10:00:00Z')
const d = (s: string) => new Date(s)

describe('statusOf', () => {
  it('reads the editor state and the dates', () => {
    expect(statusOf({ state: 'draft', publishAt: null, unpublishAt: null }, now)).toBe('draft')
    expect(statusOf({ state: 'published', publishAt: null, unpublishAt: null }, now)).toBe(
      'published',
    )
    expect(
      statusOf(
        { state: 'published', publishAt: d('2026-10-22T00:00:00Z'), unpublishAt: null },
        now,
      ),
    ).toBe('scheduled')
    expect(
      statusOf(
        { state: 'published', publishAt: d('2026-10-20T00:00:00Z'), unpublishAt: null },
        now,
      ),
    ).toBe('published')
    expect(
      statusOf(
        { state: 'published', publishAt: null, unpublishAt: d('2026-10-21T09:00:00Z') },
        now,
      ),
    ).toBe('archived')
    expect(statusOf({ state: 'archived', publishAt: null, unpublishAt: null }, now)).toBe(
      'archived',
    )
  })
})
describe('publishProblems', () => {
  it('lists what is missing', () => {
    expect(
      publishProblems({ title: ' ', bodyEmpty: true, publishAt: null, unpublishAt: null }),
    ).toEqual(['title', 'body'])
    expect(
      publishProblems({
        title: 'x',
        bodyEmpty: false,
        publishAt: d('2026-11-02'),
        unpublishAt: d('2026-11-01'),
      }),
    ).toEqual(['dates'])
    expect(
      publishProblems({ title: 'x', bodyEmpty: false, publishAt: null, unpublishAt: null }),
    ).toEqual([])
  })
})
describe('uniqueSlug', () => {
  it('adds a number when taken', () => {
    const taken = new Set(['a', 'a-2'])
    expect(uniqueSlug('a', (s) => taken.has(s))).toBe('a-3')
    expect(uniqueSlug('', () => false)).toBe('sans-titre')
  })
})
