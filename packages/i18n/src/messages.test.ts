import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createT } from './t.ts'
import { NNBSP } from './typography.ts'

type Tree = { [key: string]: string | Tree }

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    if (key === '$schema') return []
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : keys(value, path)
  })
}

const load = (locale: string): Tree =>
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))

describe('messages', () => {
  it('FR and EN define exactly the same keys', () => {
    expect(keys(load('en')).sort()).toEqual(keys(load('fr')).sort())
  })

  it('translates per call and applies French typography', () => {
    expect(createT('en')('common.greeting', { name: 'Joël' })).toBe('Hello Joël')
    expect(createT('fr')('common.greeting', { name: 'Joël' })).toBe('Bonjour Joël')
    expect(createT('fr')('site.tagline')).toContain(`VALIDER${' '}:`)
    expect(NNBSP).toBe(' ')
  })
})
